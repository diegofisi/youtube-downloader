import { I, esc } from '../../../app/icons';
import { bus } from '../../../core/bus/event-bus';
import { showToast } from '../../../shared/ui/toast';
import { showModal } from '../../../shared/ui/modal';
import { analyzeUrls } from '../../preview/preview.api';
import type { AnalyzedEntry, VideoMeta, PlaylistMeta } from '../../preview/preview.types';
import { enqueue } from '../../queue';
import {
  isConnected,
  isExpired,
  refreshSession,
  doLogout,
  openYouTubeLogin,
  getCookieMode,
} from '../../session';
import type { DownloadOptions } from '../../download/download.types';

const TABS = [
  { key: 'wl', label: 'Ver más tarde', url: 'https://www.youtube.com/playlist?list=WL' },
  { key: 'liked', label: 'Me gusta', url: 'https://www.youtube.com/playlist?list=LL' },
  { key: 'subs', label: 'Suscripciones', url: 'https://www.youtube.com/feed/subscriptions' },
  { key: 'history', label: 'Historial', url: 'https://www.youtube.com/feed/history' },
];
const BENEFITS = [
  'Descarga videos exclusivos para miembros',
  'Accede a tus playlists, “Ver más tarde” y “Me gusta”',
  'Sin extensiones ni copiar cookies a mano',
];

let tab = 'wl';
let loadSeq = 0;
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
function toQueueItem(v: VideoMeta) {
  return {
    url: v.url,
    title: v.title,
    channel: v.channel,
    grad: 'linear-gradient(135deg,#3a2d6b,#c2456b)',
    thumbnail: v.thumbnail,
    fmt: 'Máxima · MP4',
    options: defaultOptions(),
  };
}

function renderAccountCard(): void {
  const badge = $('acc-badge');
  const badgeText = $('acc-badge-text');
  const desc = $('acc-desc');
  const reconnect = $('btn-yt-reconnect');
  if (isConnected()) {
    badge.style.color = 'var(--success)';
    badge.style.background = 'var(--successSoft)';
    badgeText.textContent = 'Conectada';
    desc.textContent = 'Sesión activa con cookies';
    reconnect.hidden = true;
  } else {
    badge.style.color = 'var(--warn)';
    badge.style.background = 'var(--warnSoft)';
    badgeText.textContent = 'Caducada';
    desc.textContent = 'La sesión venció o está incompleta — reconéctate para contenido de miembros';
    reconnect.hidden = false;
  }
}

async function updateConnection(): Promise<void> {
  await refreshSession();
  const logged = isConnected() || isExpired();
  $('yt-logged-out').hidden = logged;
  $('yt-logged-in').hidden = !logged;
  if (logged) {
    renderAccountCard();
    if (videos.length === 0) loadTab();
  }
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
        if (tab === b.dataset.tab) return;
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

function emptyState(title: string, msg: string, showReconnect: boolean): string {
  return `<div style="grid-column:1/-1;text-align:center;padding:50px 20px;border:1.5px dashed var(--border2);border-radius:16px;color:var(--text3)">
    <div style="font-size:14px;font-weight:600;color:var(--text2)">${esc(title)}</div>
    <div style="font-size:12.5px;margin-top:5px">${esc(msg)}</div>
    ${showReconnect ? `<button id="yt-empty-reconnect" class="acc-btn" style="margin-top:16px;height:38px;padding:0 18px;border-radius:10px;background:var(--accent);color:var(--accentText);font-weight:600;font-size:13px">Volver a iniciar sesión</button>` : ''}
  </div>`;
}
function wireEmptyReconnect(): void {
  document.getElementById('yt-empty-reconnect')?.addEventListener('click', () => {
    openYouTubeLogin().catch(() => showToast('No se pudo abrir el login', '', 'error'));
  });
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
        enqueue([toQueueItem(v)]);
        showToast('Añadido a la cola', v.title, 'done');
      });
    });
}

async function loadTab(): Promise<void> {
  const cur = TABS.find((t) => t.key === tab)!;
  const seq = ++loadSeq;
  sel.clear();
  videos = [];
  // Título/contador correctos desde el arranque de la carga (antes se quedaba el anterior).
  $('yt-title').textContent = cur.label;
  $('yt-count').textContent = '';
  ($('btn-yt-download-sel') as HTMLElement).hidden = true;
  $('yt-list').innerHTML = `<div style="grid-column:1/-1;display:flex;align-items:center;justify-content:center;gap:9px;padding:40px;color:var(--text2);font-size:13px">${I.spinner} Cargando ${esc(cur.label)}…</div>`;
  try {
    const entries = await analyzeUrls([cur.url]);
    if (seq !== loadSeq) return; // cambió de tab mientras cargaba
    videos = flatten(entries);
    if (videos.length === 0) {
      await refreshSession();
      renderAccountCard();
      if (!isConnected()) {
        $('yt-list').innerHTML = emptyState(
          'Tu sesión no está activa',
          'YouTube no reconoció la sesión. Vuelve a iniciar sesión para ver tu contenido.',
          true,
        );
        wireEmptyReconnect();
      } else {
        $('yt-list').innerHTML = emptyState('Nada por aquí', `No se encontraron videos en ${cur.label}.`, false);
      }
      return;
    }
    renderList();
  } catch (e) {
    if (seq !== loadSeq) return;
    const msg = String(e);
    const authIssue = /login|account|cookies|autenticaci/i.test(msg);
    if (authIssue) {
      await refreshSession();
      renderAccountCard();
      $('yt-list').innerHTML = emptyState(
        'Tu sesión no está activa',
        'YouTube pidió iniciar sesión de nuevo para ver este contenido.',
        true,
      );
      wireEmptyReconnect();
    } else {
      $('yt-list').innerHTML = emptyState('No se pudo cargar', msg, false);
    }
  }
}

async function handleLogout(): Promise<void> {
  const ok = await showModal(
    'Cerrar sesión',
    'Se borrarán las cookies guardadas en este equipo. Podrás volver a conectarte cuando quieras.\n\n¿Cerrar sesión de YouTube?',
    true,
  );
  if (!ok) return;
  try {
    await doLogout();
    videos = [];
    sel.clear();
    $('yt-logged-out').hidden = false;
    $('yt-logged-in').hidden = true;
    showToast('Sesión cerrada', 'Las cookies fueron eliminadas.', 'done');
  } catch (e) {
    showToast('No se pudo cerrar sesión', String(e), 'error');
  }
}

export function initAccount(): void {
  renderBenefits();
  renderTabs();
  $('btn-yt-login').addEventListener('click', () =>
    openYouTubeLogin().catch(() => showToast('No se pudo abrir el login', '', 'error')),
  );
  $('btn-yt-reconnect').addEventListener('click', () =>
    openYouTubeLogin().catch(() => showToast('No se pudo abrir el login', '', 'error')),
  );
  $('btn-yt-logout').addEventListener('click', handleLogout);
  $('btn-yt-download-sel').addEventListener('click', () => {
    const items = videos.filter((v) => sel.has(v.url));
    if (!items.length) return;
    enqueue(items.map(toQueueItem));
    sel.clear();
    renderList();
    bus.emit('nav:goto', { view: 'cola' });
    showToast('Añadido a la cola', `${items.length} videos en proceso.`, 'done');
  });
  bus.on('session:connected', () => {
    videos = [];
    updateConnection();
  });
  bus.on('session:changed', () => updateConnection());
  bus.on('nav:changed', ({ view }) => {
    if (view === 'youtube') updateConnection();
  });
  updateConnection();
}
