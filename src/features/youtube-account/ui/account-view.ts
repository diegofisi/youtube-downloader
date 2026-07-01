import { analyzeUrls } from '../../preview/preview.api';
import type { AnalyzedEntry, VideoMeta, PlaylistMeta } from '../../preview/preview.types';
import { enqueueUrls } from '../../download';
import { getCookieMode, openYouTubeLogin } from '../../session';
import { bus } from '../../../core/bus/event-bus';
import { showToast } from '../../../shared/ui/toast';

interface Source {
  key: string;
  label: string;
  url: string;
}

const SOURCES: Source[] = [
  { key: 'wl', label: 'Ver más tarde', url: 'https://www.youtube.com/playlist?list=WL' },
  { key: 'liked', label: 'Me gusta', url: 'https://www.youtube.com/playlist?list=LL' },
  { key: 'subs', label: 'Suscripciones', url: 'https://www.youtube.com/feed/subscriptions' },
];

const disconnected = document.getElementById('account-disconnected') as HTMLElement;
const connected = document.getElementById('account-connected') as HTMLElement;
const loginBtn = document.getElementById('btn-account-login') as HTMLButtonElement;
const sourcesEl = document.getElementById('acc-sources') as HTMLElement;
const listEl = document.getElementById('acc-list') as HTMLElement;
const actionsEl = document.getElementById('acc-actions') as HTMLElement;
const selectedEl = document.getElementById('acc-selected') as HTMLElement;
const downloadBtn = document.getElementById('btn-acc-download') as HTMLButtonElement;

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

function flatten(entries: AnalyzedEntry[]): VideoMeta[] {
  const out: VideoMeta[] = [];
  for (const e of entries) {
    if (e.is_playlist) out.push(...(e as PlaylistMeta).entries);
    else out.push(e as VideoMeta);
  }
  return out;
}

function cardHtml(v: VideoMeta): string {
  const meta = [v.channel, fmtDuration(v.duration)].filter(Boolean).map(esc).join(' · ');
  return `
    <div class="pv-card">
      <input type="checkbox" class="pv-check" data-url="${esc(v.url)}" checked>
      <div class="pv-thumb pv-thumb--empty"></div>
      <div class="pv-info">
        <div class="pv-title">${esc(v.title)}</div>
        <div class="pv-meta">${meta}</div>
      </div>
    </div>`;
}

function checkedUrls(): string[] {
  return Array.from(listEl.querySelectorAll<HTMLInputElement>('.pv-check:checked')).map(
    (c) => c.dataset.url!,
  );
}

function updateSelected(): void {
  const n = checkedUrls().length;
  selectedEl.textContent = `${n} seleccionados`;
  downloadBtn.disabled = n === 0;
}

async function loadSource(src: Source, btn: HTMLButtonElement): Promise<void> {
  sourcesEl.querySelectorAll('.chip').forEach((c) => c.classList.remove('is-active'));
  btn.classList.add('is-active');
  actionsEl.style.display = 'none';
  listEl.innerHTML = '<div class="pv-loading">Cargando…</div>';

  try {
    const entries = await analyzeUrls([src.url]);
    const videos = flatten(entries).filter((v) => v.id);
    if (videos.length === 0) {
      listEl.innerHTML =
        '<div class="pv-loading">No se encontraron videos (¿sesión caducada?).</div>';
      return;
    }
    listEl.innerHTML = videos.map(cardHtml).join('');
    actionsEl.style.display = '';
    updateSelected();
  } catch (e) {
    listEl.innerHTML = `<div class="pv-loading">Error: ${esc(String(e))}</div>`;
  }
}

function updateConnectionState(): void {
  const isConnected = getCookieMode() !== 'none';
  disconnected.style.display = isConnected ? 'none' : '';
  connected.style.display = isConnected ? '' : 'none';
}

export function initAccount(): void {
  sourcesEl.innerHTML = SOURCES.map(
    (s) => `<button class="chip" data-key="${s.key}">${esc(s.label)}</button>`,
  ).join('');

  sourcesEl.querySelectorAll<HTMLButtonElement>('.chip').forEach((btn) => {
    const src = SOURCES.find((s) => s.key === btn.dataset.key)!;
    btn.addEventListener('click', () => loadSource(src, btn));
  });

  loginBtn.addEventListener('click', () => {
    openYouTubeLogin().catch(() => showToast('No se pudo abrir el login', 'error'));
  });

  listEl.addEventListener('change', updateSelected);

  downloadBtn.addEventListener('click', () => {
    const urls = checkedUrls();
    if (urls.length > 0) enqueueUrls(urls);
  });

  bus.on('nav:changed', ({ view }) => {
    if (view === 'youtube') updateConnectionState();
  });
  bus.on('session:connected', updateConnectionState);

  updateConnectionState();
}
