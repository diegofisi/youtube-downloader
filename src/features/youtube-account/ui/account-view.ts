import { I, esc } from '../../../app/icons';
import { bus } from '../../../core/bus/event-bus';
import { showToast } from '../../../shared/ui/toast';
import { analyzeUrls } from '../../preview/preview.api';
import type { AnalyzedEntry, VideoMeta, PlaylistMeta } from '../../preview/preview.types';
import { enqueue } from '../../queue';
import { isConnected, openYouTubeLogin, getCookieMode } from '../../session';
import type { DownloadOptions } from '../../download/download.types';

const TABS = [
  { key: 'subs', label: 'Suscripciones', url: 'https://www.youtube.com/feed/subscriptions' },
  { key: 'wl', label: 'Ver más tarde', url: 'https://www.youtube.com/playlist?list=WL' },
  { key: 'liked', label: 'Me gusta', url: 'https://www.youtube.com/playlist?list=LL' },
];
const BENEFITS = [
  'Descarga videos exclusivos para miembros',
  'Accede a tus playlists, “Ver más tarde” y “Me gusta”',
  'Sin extensiones ni copiar cookies a mano',
];

let tab = 'subs';
const sel = new Set<string>();
let videos: VideoMeta[] = [];

const $ = (id: string) => document.getElementById(id)!;

function fmtDuration(s?: number): string {
  if (!s) return '';
  const sec = Math.floor(s);
  const m = Math.floor(sec / 60);
  const ss = sec % 60;
  const h = Math.floor(m / 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m % 60)}:${pad(ss)}` : `${m}:${pad(ss)}`;
}
function flatten(entries: AnalyzedEntry[]): VideoMeta[] {
  const out: VideoMeta[] = [];
  for (const e of entries) {
    if (e.is_playlist) out.push(...(e as PlaylistMeta).entries);
    else out.push(e as VideoMeta);
  }
  return out.filter((v) => v.id);
}
function defaultOptions(): DownloadOptions {
  return {
    mode: 'video',
    quality: 'max',
    container: 'mp4',
    audioFormat: 'mp3',
    audioBitrate: 0,
    subtitles: false,
    subLangs: 'es,en',
    embedThumbnail: true,
    outputTemplate: undefined,
    cookieMode: getCookieMode(),
  };
}

function updateConnection(): void {
  const conn = isConnected();
  $('yt-logged-out').hidden = conn;
  $('yt-logged-in').hidden = !conn;
  if (conn && videos.length === 0) loadTab();
}

function renderBenefits(): void {
  $('yt-benefits').innerHTML = BENEFITS.map(
    (b) => `<div style="display:flex;align-items:center;gap:11px;padding:12px 14px;background:var(--panel);border:1px solid var(--border);border-radius:11px">
      <span style="width:26px;height:26px;flex:none;border-radius:8px;display:flex;align-items:center;justify-content:center;background:var(--successSoft);color:var(--success)">${I.check}</span>
      <span style="font-size:13px;color:var(--text)">${esc(b)}</span></div>`,
  ).join('');
}

function renderTabs(): void {
  $('yt-tabs').innerHTML = TABS.map((t) => {
    const on = tab === t.key;
    return `<button data-tab="${t.key}" style="padding:7px 14px;border-radius:9px;font-size:12.5px;font-weight:600;border:1.5px solid ${
      on ? 'var(--accent)' : 'var(--border)'
    };background:${on ? 'var(--accentSoft)' : 'transparent'};color:${on ? 'var(--accent)' : 'var(--text2)'}">${t.label}</button>`;
  }).join('');
  $('yt-tabs')
    .querySelectorAll<HTMLElement>('[data-tab]')
    .forEach((b) =>
      b.addEventListener('click', () => {
        tab = b.dataset.tab!;
        renderTabs();
        loadTab();
      }),
    );
}

function checkOverlay(on: boolean): string {
  return `<button class="yt-check" style="position:absolute;top:8px;left:8px;width:24px;height:24px;border-radius:7px;display:flex;align-items:center;justify-content:center;border:1.8px solid ${
    on ? 'var(--accent)' : 'rgba(255,255,255,.7)'
  };background:${on ? 'var(--accent)' : 'rgba(0,0,0,.4)'};color:#fff;backdrop-filter:blur(4px)">${on ? I.check : ''}</button>`;
}

function renderList(): void {
  const cur = TABS.find((t) => t.key === tab)!;
  $('yt-title').textContent = cur.label;
  $('yt-count').textContent = videos.length ? `${videos.length} videos` : '';
  const nSel = videos.filter((v) => sel.has(v.url)).length;
  const dlBtn = $('btn-yt-download-sel') as HTMLElement;
  dlBtn.hidden = nSel === 0;
  dlBtn.textContent = `Descargar ${nSel}`;

  $('yt-list').innerHTML = videos
    .map((v) => {
      const on = sel.has(v.url);
      const grad = 'linear-gradient(135deg,#3a2d6b,#c2456b)';
      const thumbInner = v.thumbnail
        ? `<img src="${esc(v.thumbnail)}" loading="lazy" style="width:100%;height:100%;object-fit:cover" alt="">`
        : `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;opacity:.85">${I.play20}</div>`;
      return `<div data-url="${esc(v.url)}" style="background:var(--panel);border:1px solid ${
        on ? 'var(--accent)' : 'var(--border)'
      };border-radius:13px;overflow:hidden">
        <div style="position:relative;aspect-ratio:16/9;background:${grad}">
          ${thumbInner}
          ${checkOverlay(on)}
          <button class="yt-dl" title="Descargar" style="position:absolute;top:8px;right:8px;width:30px;height:30px;border-radius:8px;background:rgba(0,0,0,.6);color:#fff;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)">${I.download}</button>
          ${v.duration ? `<span style="position:absolute;bottom:8px;right:8px;background:rgba(0,0,0,.78);color:#fff;font-size:10.5px;font-weight:600;padding:1.5px 5px;border-radius:5px;font-family:'JetBrains Mono',monospace">${fmtDuration(v.duration)}</span>` : ''}
        </div>
        <div style="padding:10px 11px 12px">
          <div style="font-weight:600;font-size:12.5px;line-height:1.35;color:var(--text);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:34px">${esc(v.title)}</div>
          <div style="font-size:11.5px;color:var(--text2);margin-top:5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(v.channel)}</div>
        </div>
      </div>`;
    })
    .join('');

  $('yt-list')
    .querySelectorAll<HTMLElement>('[data-url]')
    .forEach((card) => {
      const url = card.dataset.url!;
      const v = videos.find((x) => x.url === url)!;
      card.querySelector('.yt-check')?.addEventListener('click', (e) => {
        e.stopPropagation();
        sel.has(url) ? sel.delete(url) : sel.add(url);
        renderList();
      });
      card.querySelector('.yt-dl')?.addEventListener('click', (e) => {
        e.stopPropagation();
        enqueue([{ url: v.url, title: v.title, channel: v.channel, grad: 'linear-gradient(135deg,#3a2d6b,#c2456b)', thumbnail: v.thumbnail, fmt: 'Máxima · MP4', options: defaultOptions() }]);
        showToast('Añadido a la cola', v.title, 'done');
      });
    });
}

async function loadTab(): Promise<void> {
  const cur = TABS.find((t) => t.key === tab)!;
  sel.clear();
  $('yt-list').innerHTML = `<div style="grid-column:1/-1;display:flex;align-items:center;justify-content:center;gap:9px;padding:40px;color:var(--text2);font-size:13px">${I.spinner} Cargando…</div>`;
  try {
    const entries = await analyzeUrls([cur.url]);
    videos = flatten(entries);
    if (videos.length === 0) {
      $('yt-list').innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:50px 20px;color:var(--text3)"><div style="font-size:14px;font-weight:600;color:var(--text2)">Nada por aquí</div><div style="font-size:12.5px;margin-top:5px">No se encontraron videos (¿sesión caducada?).</div></div>`;
      $('yt-count').textContent = '';
      return;
    }
    renderList();
  } catch (e) {
    $('yt-list').innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--danger);font-size:13px">Error: ${esc(String(e))}</div>`;
  }
}

export function initAccount(): void {
  renderBenefits();
  renderTabs();
  $('btn-yt-login').addEventListener('click', () => openYouTubeLogin().catch(() => showToast('No se pudo abrir el login', '', 'error')));
  $('btn-yt-logout').addEventListener('click', () => showToast('Sesión', 'Para cerrar sesión, borra cookies.txt (v2).', 'info'));
  $('btn-yt-download-sel').addEventListener('click', () => {
    const items = videos.filter((v) => sel.has(v.url));
    if (!items.length) return;
    enqueue(items.map((v) => ({ url: v.url, title: v.title, channel: v.channel, grad: 'linear-gradient(135deg,#3a2d6b,#c2456b)', thumbnail: v.thumbnail, fmt: 'Máxima · MP4', options: defaultOptions() })));
    sel.clear();
    renderList();
    bus.emit('nav:goto', { view: 'cola' });
    showToast('Añadido a la cola', `${items.length} videos en proceso.`, 'done');
  });
  bus.on('session:connected', updateConnection);
  bus.on('nav:changed', ({ view }) => {
    if (view === 'youtube') updateConnection();
  });
  updateConnection();
}
