import { analyzeUrls, onPreviewProgress } from '../preview.api';
import type { AnalyzedEntry, VideoMeta, PlaylistMeta } from '../preview.types';
import { enqueueUrls } from '../../download';
import { showToast } from '../../../shared/ui/toast';

const urlInput = document.getElementById('url-input') as HTMLTextAreaElement;
const previewBtn = document.getElementById('btn-preview') as HTMLButtonElement;
const panel = document.getElementById('preview-panel') as HTMLElement;
const listEl = document.getElementById('preview-list') as HTMLElement;
const countEl = document.getElementById('preview-count') as HTMLElement;
const selectedEl = document.getElementById('preview-selected') as HTMLElement;
const downloadSelectedBtn = document.getElementById('btn-download-selected') as HTMLButtonElement;

function getUrls(): string[] {
  return urlInput.value
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('http'));
}

function esc(s: string): string {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function fmtDuration(s?: number): string {
  if (!s) return '';
  const sec = Math.floor(s);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const ss = sec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(ss)}` : `${m}:${pad(ss)}`;
}

function fmtSize(b?: number): string {
  if (!b) return '';
  const mb = b / 1048576;
  return mb >= 1024 ? `~${(mb / 1024).toFixed(2)} GB` : `~${mb.toFixed(0)} MB`;
}

interface Badge {
  label: string;
  cls: 'ok' | 'warn' | 'err';
  downloadable: boolean;
}

function availability(a?: string): Badge {
  if (!a) return { label: 'Disponible', cls: 'ok', downloadable: true };
  if (a.startsWith('error')) return { label: 'No disponible', cls: 'err', downloadable: false };
  switch (a) {
    case 'public':
      return { label: 'Público', cls: 'ok', downloadable: true };
    case 'unlisted':
      return { label: 'No listado', cls: 'ok', downloadable: true };
    case 'subscriber_only':
      return { label: 'Miembros', cls: 'warn', downloadable: true };
    case 'premium_only':
      return { label: 'Premium', cls: 'warn', downloadable: true };
    case 'needs_auth':
      return { label: 'Requiere sesión', cls: 'warn', downloadable: true };
    case 'private':
      return { label: 'Privado', cls: 'err', downloadable: false };
    default:
      return { label: a, cls: 'ok', downloadable: true };
  }
}

function thumbHtml(v: VideoMeta): string {
  if (v.thumbnail) {
    return `<img class="pv-thumb" src="${esc(v.thumbnail)}" loading="lazy" alt="">`;
  }
  return `<div class="pv-thumb pv-thumb--empty"></div>`;
}

function videoCardHtml(v: VideoMeta): string {
  const b = availability(v.availability);
  const meta = [v.channel, fmtDuration(v.duration), fmtSize(v.size_bytes)]
    .filter(Boolean)
    .map(esc)
    .join(' · ');
  const checked = b.downloadable ? 'checked' : '';
  const disabled = b.downloadable ? '' : 'disabled';
  return `
    <div class="pv-card">
      <input type="checkbox" class="pv-check" data-url="${esc(v.url)}" ${checked} ${disabled}>
      ${thumbHtml(v)}
      <div class="pv-info">
        <div class="pv-title">${esc(v.title)}</div>
        <div class="pv-meta">${meta}</div>
      </div>
      <span class="pv-badge pv-badge--${b.cls}">${esc(b.label)}</span>
    </div>`;
}

function playlistHtml(p: PlaylistMeta): string {
  const children = p.entries.map(videoCardHtml).join('');
  return `
    <div class="pv-group">
      <div class="pv-group-head">
        <input type="checkbox" class="pv-check-group" checked>
        <span class="pv-badge pv-badge--accent">PLAYLIST</span>
        <span class="pv-title">${esc(p.title)}</span>
        <span class="pv-meta">${esc(p.channel)} · ${p.count} videos</span>
      </div>
      <div class="pv-children">${children}</div>
    </div>`;
}

function render(entries: AnalyzedEntry[]): void {
  listEl.innerHTML = entries
    .map((e) => (e.is_playlist ? playlistHtml(e as PlaylistMeta) : videoCardHtml(e as VideoMeta)))
    .join('');
  updateSelected();
}

function checkedUrls(): string[] {
  return Array.from(listEl.querySelectorAll<HTMLInputElement>('.pv-check:checked')).map(
    (c) => c.dataset.url!,
  );
}

function updateSelected(): void {
  const n = checkedUrls().length;
  selectedEl.textContent = `${n} seleccionados`;
  downloadSelectedBtn.disabled = n === 0;
}

async function handlePreview(): Promise<void> {
  const urls = getUrls();
  if (urls.length === 0) {
    showToast('Pega al menos una URL de YouTube', 'error');
    return;
  }

  previewBtn.disabled = true;
  const originalLabel = previewBtn.querySelector('svg')?.outerHTML ?? '';
  previewBtn.innerHTML = `${originalLabel} Analizando 0/${urls.length}...`;
  panel.style.display = '';
  listEl.innerHTML = '<div class="pv-loading">Resolviendo metadatos…</div>';

  const unlisten = await onPreviewProgress((done, total) => {
    previewBtn.innerHTML = `${originalLabel} Analizando ${done}/${total}...`;
  });

  try {
    const entries = await analyzeUrls(urls);
    render(entries);
    const total = entries.reduce(
      (acc, e) => acc + (e.is_playlist ? (e as PlaylistMeta).count : 1),
      0,
    );
    countEl.textContent = `${total} videos`;
    countEl.style.display = 'inline';
  } catch (e) {
    listEl.innerHTML = `<div class="pv-loading">Error: ${esc(String(e))}</div>`;
  } finally {
    unlisten();
    previewBtn.disabled = false;
    previewBtn.innerHTML = `${originalLabel} Previsualizar`;
  }
}

export function initPreviewPanel(): void {
  previewBtn.addEventListener('click', handlePreview);

  // Delegación: checkboxes de video y de grupo (playlist)
  listEl.addEventListener('change', (e) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('pv-check-group')) {
      const group = target.closest('.pv-group')!;
      const checked = (target as HTMLInputElement).checked;
      group
        .querySelectorAll<HTMLInputElement>('.pv-check:not([disabled])')
        .forEach((c) => (c.checked = checked));
    }
    updateSelected();
  });

  downloadSelectedBtn.addEventListener('click', () => {
    const urls = checkedUrls();
    if (urls.length === 0) return;
    enqueueUrls(urls);
  });
}
