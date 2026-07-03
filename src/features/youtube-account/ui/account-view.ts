import { I } from '../../../shared/ui/icons';
import { esc } from '../../../shared/lib/html';
import { bus } from '../../../core/bus/event-bus';
import { showToast } from '../../../shared/ui/toast';
import { showModal } from '../../../shared/ui/modal';
import { $ } from '../../../shared/ui/dom';
import { fmtDuration } from '../../../shared/lib/format';
import { CARD_GRAD } from '../../../shared/ui/gradients';
import { openAnchoredMenu, closeAnchoredMenu } from '../../../shared/ui/anchored-menu';
import { analyzeUrls } from '../../preview';
import type { AnalyzedEntry, VideoMeta, PlaylistMeta } from '../../preview';
import { enqueue } from '../../queue';
import {
  isConnected,
  isExpired,
  refreshSession,
  doLogout,
  openYouTubeLogin,
  getCookieMode,
  getAccountInfo,
  type AccountInfo,
} from '../../session';
import type { DownloadOptions } from '../../download';
import { t } from '../../../core/i18n';

const TABS = [
  { key: 'wl', label: t('Ver más tarde', 'Watch later'), url: 'https://www.youtube.com/playlist?list=WL' },
  { key: 'liked', label: t('Me gusta', 'Liked'), url: 'https://www.youtube.com/playlist?list=LL' },
  { key: 'subs', label: t('Suscripciones', 'Subscriptions'), url: 'https://www.youtube.com/feed/subscriptions' },
  { key: 'history', label: t('Historial', 'History'), url: 'https://www.youtube.com/feed/history' },
  { key: 'playlists', label: t('Playlists', 'Playlists'), url: 'https://www.youtube.com/feed/playlists' },
];
const BENEFITS = [
  t('Descarga videos exclusivos para miembros', 'Download members-only videos'),
  t('Accede a tus playlists, “Ver más tarde” y “Me gusta”', 'Access your playlists, “Watch later” and “Liked”'),
  t('Sin extensiones ni copiar cookies a mano', 'No extensions or copying cookies by hand'),
];

/** Tamaño de página para la paginación con "Ver más". */
const PAGE = 50;

let tab = 'wl';
let loadSeq = 0;
const sel = new Set<string>();
let videos: VideoMeta[] = [];
/** Siguiente índice 1-based a pedir con "Ver más". */
let nextStart = 1;
/** true si la última página vino llena (puede haber más). */
let hasMore = false;
let loadingMore = false;
/** Playlist abierta dentro de la pestaña "Playlists" (null = grid de playlists). */
let openPlaylist: { url: string; title: string } | null = null;

function flatten(entries: AnalyzedEntry[]): VideoMeta[] {
  const out: VideoMeta[] = [];
  for (const e of entries) {
    if (e.is_playlist && 'entries' in e) out.push(...(e as PlaylistMeta).entries);
    else out.push(e as VideoMeta);
  }
  return out.filter((v) => v.id);
}
/** Fuente actual: la pestaña activa, o la playlist abierta dentro de "Playlists". */
function currentSource(): { url: string; label: string } {
  if (tab === 'playlists' && openPlaylist) return { url: openPlaylist.url, label: openPlaylist.title };
  const cur = TABS.find((t) => t.key === tab)!;
  return { url: cur.url, label: cur.label };
}
/** ¿Estamos mostrando el grid de playlists (no sus videos)? */
function inPlaylistGrid(): boolean {
  return tab === 'playlists' && !openPlaylist;
}
/** Pide una página [start, start+PAGE-1] de la fuente y la aplana. */
async function fetchPage(url: string, start: number): Promise<VideoMeta[]> {
  const entries = await analyzeUrls([url], { start, end: start + PAGE - 1 });
  return flatten(entries);
}
/** Añade una página evitando duplicados (por id o url) si el feed se movió. */
function appendUnique(page: VideoMeta[]): void {
  const known = new Set(videos.map((v) => v.id || v.url));
  for (const v of page) {
    const key = v.id || v.url;
    if (known.has(key)) continue;
    known.add(key);
    videos.push(v);
  }
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
    videoId: v.id,
    title: v.title,
    channel: v.channel,
    grad: CARD_GRAD,
    thumbnail: v.thumbnail,
    duration: v.duration,
    fmt: t('Máxima · MP4', 'Max · MP4'),
    options: defaultOptions(),
  };
}

// ---------- mini-menú de descarga por tarjeta ----------
/** Abre el menú "Descargar / Descarga personalizada" anclado al botón ⬇ de una tarjeta. */
function openDlMenu(anchor: HTMLElement, v: VideoMeta): void {
  openAnchoredMenu(anchor, [
    {
      icon: I.download,
      label: t('Descargar', 'Download'),
      onPick: () => {
        enqueue([toQueueItem(v)]);
        showToast(t('Añadido a la cola', 'Added to queue'), v.title, 'done');
      },
    },
    {
      icon: I.settings,
      label: t('Descarga personalizada', 'Custom download'),
      onPick: () => {
        bus.emit('descargar:prefill', { urls: [v.url] });
        bus.emit('nav:goto', { view: 'descargar' });
      },
    },
  ]);
}

// ---------- info real de la cuenta (nombre, handle y avatar) ----------
/** Caché en memoria de la cuenta conectada (se invalida al logout/reconectar). */
let accountInfo: AccountInfo | null = null;
/** Promesa en curso: evita pedir la cuenta más de una vez por sesión. */
let accountInfoPromise: Promise<AccountInfo | null> | null = null;

function invalidateAccountInfo(): void {
  accountInfo = null;
  accountInfoPromise = null;
  applyAccountInfo(); // restaura la UI genérica ("A" + "Cuenta de YouTube")
}

/** Pide getAccountInfo() una sola vez y pinta el resultado al llegar. */
function ensureAccountInfo(): void {
  if (accountInfoPromise) return;
  const p = getAccountInfo().catch(() => null);
  accountInfoPromise = p;
  void p.then((info) => {
    if (p !== accountInfoPromise) return; // invalidada mientras cargaba
    accountInfo = info;
    applyAccountInfo();
  });
}

/**
 * Pinta (o restaura) avatar y nombre en la tarjeta de cuenta.
 * Los ids `acc-avatar`/`acc-name` se asignan dinámicamente en initAccount().
 */
function applyAccountInfo(): void {
  const avatar = document.getElementById('acc-avatar');
  const nameEl = document.getElementById('acc-name');
  if (!avatar || !nameEl) return;

  if (accountInfo) {
    nameEl.textContent = accountInfo.name;
    const prev = avatar.querySelector('img');
    if (accountInfo.avatarUrl && prev?.getAttribute('src') !== accountInfo.avatarUrl) {
      // El degradado del div queda de fondo mientras carga y si la imagen falla.
      avatar.textContent = '';
      const img = document.createElement('img');
      img.alt = '';
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%';
      img.onerror = () => {
        img.remove();
        avatar.textContent = 'A';
      };
      img.src = accountInfo.avatarUrl;
      avatar.appendChild(img);
    }
  } else {
    avatar.querySelector('img')?.remove();
    avatar.textContent = 'A';
    nameEl.textContent = t('Cuenta de YouTube', 'YouTube account');
  }

  // La descripción depende del estado (conectada/caducada): re-renderizar.
  if (!$('yt-logged-in').hidden) renderAccountCard();
}

function renderAccountCard(): void {
  const badge = $('acc-badge');
  const badgeText = $('acc-badge-text');
  const desc = $('acc-desc');
  const reconnect = $('btn-yt-reconnect');
  if (isConnected()) {
    badge.style.color = 'var(--success)';
    badge.style.background = 'var(--successSoft)';
    badgeText.textContent = t('Conectada', 'Connected');
    const active = t('Sesión activa con cookies', 'Active session with cookies');
    desc.textContent = accountInfo?.handle ? `${accountInfo.handle} · ${active}` : active;
    reconnect.hidden = true;
    ensureAccountInfo();
  } else {
    badge.style.color = 'var(--warn)';
    badge.style.background = 'var(--warnSoft)';
    badgeText.textContent = t('Caducada', 'Expired');
    desc.textContent = t(
      'La sesión venció o está incompleta — reconéctate para contenido de miembros',
      'The session expired or is incomplete — reconnect for members-only content',
    );
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
        openPlaylist = null;
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
    ${showReconnect ? `<button id="yt-empty-reconnect" class="acc-btn" style="margin-top:16px;height:38px;padding:0 18px;border-radius:10px;background:var(--accent);color:var(--accentText);font-weight:600;font-size:13px">${t('Volver a iniciar sesión', 'Sign in again')}</button>` : ''}
  </div>`;
}
function wireEmptyReconnect(): void {
  document.getElementById('yt-empty-reconnect')?.addEventListener('click', () => {
    openYouTubeLogin().catch(() => showToast(t('No se pudo abrir el login', 'Could not open login'), '', 'error'));
  });
}

/** Botón "← Volver a Playlists" (solo dentro de una playlist abierta). */
function backBtnHtml(): string {
  if (!openPlaylist) return '';
  return `<div style="grid-column:1/-1"><button id="yt-back" style="display:inline-flex;align-items:center;gap:7px;height:32px;padding:0 14px;border-radius:9px;border:1px solid var(--border2);background:var(--panel);color:var(--text2);font-weight:600;font-size:12.5px">${t('← Volver a Playlists', '← Back to Playlists')}</button></div>`;
}
function wireBack(): void {
  document.getElementById('yt-back')?.addEventListener('click', () => {
    openPlaylist = null;
    loadTab();
  });
}

function videoCard(v: VideoMeta): string {
  const on = sel.has(v.url);
  const grad = CARD_GRAD;
  const thumbInner = v.thumbnail
    ? `<img src="${esc(v.thumbnail)}" loading="lazy" style="width:100%;height:100%;object-fit:cover" alt="">`
    : `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;opacity:.85">${I.play20}</div>`;
  return `<div data-url="${esc(v.url)}" style="background:var(--panel);border:1px solid ${
    on ? 'var(--accent)' : 'var(--border)'
  };border-radius:13px;overflow:hidden">
    <div style="position:relative;aspect-ratio:16/9;background:${grad}">
      ${thumbInner}
      ${checkOverlay(on)}
      <button class="yt-dl" title="${t('Descargar', 'Download')}" style="position:absolute;top:8px;right:8px;width:30px;height:30px;border-radius:8px;background:rgba(0,0,0,.6);color:#fff;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)">${I.download}</button>
      ${v.duration ? `<span style="position:absolute;bottom:8px;right:8px;background:rgba(0,0,0,.78);color:#fff;font-size:10.5px;font-weight:600;padding:1.5px 5px;border-radius:5px;font-family:'JetBrains Mono',monospace">${fmtDuration(v.duration)}</span>` : ''}
    </div>
    <div style="padding:10px 11px 12px">
      <div style="font-weight:600;font-size:12.5px;line-height:1.35;color:var(--text);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:34px">${esc(v.title)}</div>
      <div style="font-size:11.5px;color:var(--text2);margin-top:5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(v.channel)}</div>
    </div>
  </div>`;
}

/** Tarjeta de playlist (pestaña "Playlists"): estilo propio, se abre al hacer click. */
function playlistCard(v: VideoMeta): string {
  const grad = 'linear-gradient(135deg,#2d3a6b,#7a45c2)';
  const thumbInner = v.thumbnail
    ? `<img src="${esc(v.thumbnail)}" loading="lazy" style="width:100%;height:100%;object-fit:cover" alt="">`
    : `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;opacity:.85;color:#fff">${I.queue}</div>`;
  const badgeLabel =
    v.playlist_count != null ? `${v.playlist_count} ${t('videos', 'videos')}` : t('Playlist', 'Playlist');
  return `<div data-plurl="${esc(v.url)}" style="background:var(--panel);border:1px solid var(--border);border-radius:13px;overflow:hidden;cursor:pointer">
    <div style="position:relative;aspect-ratio:16/9;background:${grad}">
      ${thumbInner}
      <div style="position:absolute;inset:0;background:linear-gradient(180deg,transparent 55%,rgba(0,0,0,.5))"></div>
      <span style="position:absolute;bottom:8px;right:8px;display:flex;align-items:center;gap:5px;background:rgba(0,0,0,.78);color:#fff;font-size:10.5px;font-weight:600;padding:2.5px 7px;border-radius:5px">${I.queue} ${esc(badgeLabel)}</span>
    </div>
    <div style="padding:10px 11px 12px">
      <div style="font-weight:600;font-size:12.5px;line-height:1.35;color:var(--text);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:34px">${esc(v.title)}</div>
      <div style="font-size:11.5px;color:var(--text2);margin-top:5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${v.channel ? esc(v.channel) : t('Abrir playlist →', 'Open playlist →')}</div>
    </div>
  </div>`;
}

function renderList(): void {
  closeAnchoredMenu(); // el grid se re-renderiza con innerHTML: el ancla deja de existir
  const src = currentSource();
  const plGrid = inPlaylistGrid();
  $('yt-title').textContent = src.label;

  const shown = videos;

  const noun = plGrid ? t('playlists', 'playlists') : t('videos', 'videos');
  $('yt-count').textContent = videos.length ? `${videos.length} ${noun}` : '';

  $('yt-more-wrap').hidden = !hasMore || videos.length === 0;

  const nSel = videos.filter((v) => sel.has(v.url)).length;
  const dlBtn = $('btn-yt-download-sel');
  dlBtn.hidden = nSel === 0 || plGrid;
  dlBtn.textContent = `${t('Descargar', 'Download')} ${nSel}`;
  const custBtn = document.getElementById('btn-yt-customize-sel');
  if (custBtn) custBtn.hidden = dlBtn.hidden;

  $('yt-list').innerHTML =
    backBtnHtml() + (plGrid ? shown.map(playlistCard).join('') : shown.map(videoCard).join(''));
  wireBack();

  if (plGrid) {
    $('yt-list')
      .querySelectorAll<HTMLElement>('[data-plurl]')
      .forEach((card) => {
        card.addEventListener('click', () => {
          const v = videos.find((x) => x.url === card.dataset.plurl);
          if (!v) return;
          openPlaylist = { url: v.url, title: v.title };
          loadTab();
        });
      });
    return;
  }

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
        openDlMenu(e.currentTarget as HTMLElement, v);
      });
    });
}

async function loadTab(): Promise<void> {
  closeAnchoredMenu();
  const src = currentSource();
  const seq = ++loadSeq;
  sel.clear();
  videos = [];
  nextStart = 1;
  hasMore = false;
  // Título/contador correctos desde el arranque de la carga (antes se quedaba el anterior).
  $('yt-title').textContent = src.label;
  $('yt-count').textContent = '';
  $('btn-yt-download-sel').hidden = true;
  const custBtn = document.getElementById('btn-yt-customize-sel');
  if (custBtn) custBtn.hidden = true;
  $('yt-more-wrap').hidden = true;
  $('yt-list').innerHTML = `${backBtnHtml()}<div style="grid-column:1/-1;display:flex;align-items:center;justify-content:center;gap:9px;padding:40px;color:var(--text2);font-size:13px">${I.spinner} ${t('Cargando', 'Loading')} ${esc(src.label)}…</div>`;
  wireBack();
  try {
    const page = await fetchPage(src.url, 1);
    if (seq !== loadSeq) return; // cambió de tab/playlist mientras cargaba
    appendUnique(page);
    hasMore = page.length >= PAGE;
    nextStart = 1 + PAGE;
    if (videos.length === 0) {
      await refreshSession();
      renderAccountCard();
      if (!isConnected()) {
        $('yt-list').innerHTML =
          backBtnHtml() +
          emptyState(
            t('Tu sesión no está activa', 'Your session is not active'),
            t(
              'YouTube no reconoció la sesión. Vuelve a iniciar sesión para ver tu contenido.',
              'YouTube did not recognize the session. Sign in again to see your content.',
            ),
            true,
          );
        wireEmptyReconnect();
      } else {
        $('yt-list').innerHTML =
          backBtnHtml() +
          emptyState(
            t('Nada por aquí', 'Nothing here'),
            t(
              `No se encontraron ${inPlaylistGrid() ? 'playlists' : 'videos'} en ${src.label}.`,
              `No ${inPlaylistGrid() ? 'playlists' : 'videos'} found in ${src.label}.`,
            ),
            false,
          );
      }
      wireBack();
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
      $('yt-list').innerHTML =
        backBtnHtml() +
        emptyState(
          t('Tu sesión no está activa', 'Your session is not active'),
          t(
            'YouTube pidió iniciar sesión de nuevo para ver este contenido.',
            'YouTube asked to sign in again to view this content.',
          ),
          true,
        );
      wireEmptyReconnect();
    } else {
      $('yt-list').innerHTML =
        backBtnHtml() + emptyState(t('No se pudo cargar', 'Could not load'), msg, false);
    }
    wireBack();
  }
}

/** Carga la siguiente página (paginación "Ver más") y la añade al grid. */
async function loadMore(): Promise<void> {
  if (loadingMore || !hasMore) return;
  const seq = loadSeq; // si cambia (otra pestaña/playlist), se descarta el resultado
  loadingMore = true;
  const btn = $<HTMLButtonElement>('yt-more');
  const prevHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `${I.spinner} ${t('Cargando…', 'Loading…')}`;
  try {
    const page = await fetchPage(currentSource().url, nextStart);
    if (seq !== loadSeq) return;
    nextStart += PAGE;
    hasMore = page.length >= PAGE;
    appendUnique(page);
    renderList();
  } catch (e) {
    if (seq === loadSeq)
      showToast(t('No se pudieron cargar más', 'Could not load more'), String(e), 'error');
  } finally {
    loadingMore = false;
    btn.disabled = false;
    btn.innerHTML = prevHtml;
  }
}

async function handleLogout(): Promise<void> {
  const ok = await showModal(
    t('Cerrar sesión', 'Sign out'),
    t(
      'Se borrarán las cookies guardadas en este equipo. Podrás volver a conectarte cuando quieras.\n\n¿Cerrar sesión de YouTube?',
      'The cookies stored on this device will be deleted. You can reconnect whenever you want.\n\nSign out of YouTube?',
    ),
    true,
  );
  if (!ok) return;
  try {
    await doLogout();
    videos = [];
    sel.clear();
    openPlaylist = null;
    $('yt-logged-out').hidden = false;
    $('yt-logged-in').hidden = true;
    showToast(t('Sesión cerrada', 'Signed out'), t('Las cookies fueron eliminadas.', 'The cookies were deleted.'), 'done');
  } catch (e) {
    showToast(t('No se pudo cerrar sesión', 'Could not sign out'), String(e), 'error');
  }
}

export function initAccount(): void {
  // Ids dinámicos (sin tocar index.html) para el círculo del avatar (div con
  // la "A", primer hijo de la tarjeta) y el nombre ("Cuenta de YouTube").
  const accCard = $('btn-yt-logout').parentElement as HTMLElement;
  const avatarDiv = accCard.firstElementChild as HTMLElement | null;
  if (avatarDiv) avatarDiv.id = 'acc-avatar';
  const nameSpan = accCard.querySelector<HTMLElement>('span[data-en="YouTube account"]');
  if (nameSpan) nameSpan.id = 'acc-name';

  renderBenefits();
  renderTabs();
  $('btn-yt-login').addEventListener('click', () =>
    openYouTubeLogin().catch(() =>
      showToast(t('No se pudo abrir el login', 'Could not open login'), '', 'error'),
    ),
  );
  $('btn-yt-reconnect').addEventListener('click', () =>
    openYouTubeLogin().catch(() =>
      showToast(t('No se pudo abrir el login', 'Could not open login'), '', 'error'),
    ),
  );
  $('btn-yt-logout').addEventListener('click', handleLogout);
  $('yt-more').addEventListener('click', loadMore);

  // Botón secundario "Personalizar" junto a "Descargar seleccionados" (creado
  // aquí para no tocar index.html): manda las urls elegidas a la vista Descargar.
  const custBtn = document.createElement('button');
  custBtn.id = 'btn-yt-customize-sel';
  custBtn.className = 'acc-btn';
  custBtn.hidden = true;
  custBtn.textContent = t('Personalizar', 'Customize');
  custBtn.style.cssText =
    'height:34px;padding:0 15px;border-radius:9px;border:1.5px solid var(--border2);background:transparent;color:var(--text2);font-weight:600;font-size:12.5px';
  $('btn-yt-download-sel').insertAdjacentElement('afterend', custBtn);
  custBtn.addEventListener('click', () => {
    const urls = videos.filter((v) => sel.has(v.url)).map((v) => v.url);
    if (!urls.length) return;
    bus.emit('descargar:prefill', { urls });
    sel.clear();
    renderList();
    bus.emit('nav:goto', { view: 'descargar' });
    showToast(
      t('Personaliza tu descarga', 'Customize your download'),
      t(
        `${urls.length} ${urls.length === 1 ? 'video listo' : 'videos listos'} en Descargar.`,
        `${urls.length} ${urls.length === 1 ? 'video' : 'videos'} ready in Download.`,
      ),
      'info',
    );
  });

  $('btn-yt-download-sel').addEventListener('click', () => {
    const items = videos.filter((v) => sel.has(v.url));
    if (!items.length) return;
    enqueue(items.map(toQueueItem));
    sel.clear();
    renderList();
    bus.emit('nav:goto', { view: 'cola' });
    showToast(
      t('Añadido a la cola', 'Added to queue'),
      t(`${items.length} videos en proceso.`, `${items.length} videos in progress.`),
      'done',
    );
  });
  // Un solo camino: session:changed cubre todas las transiciones (session:connected
  // siempre viene acompañado de session:changed, así evitamos dos loadTab concurrentes).
  bus.on('session:changed', () => {
    // Cualquier transición (logout, reconexión, caducidad) invalida la info
    // cacheada de la cuenta; se re-pide solo si la sesión queda conectada.
    invalidateAccountInfo();
    if (isConnected()) {
      videos = []; // al conectar, recargar la lista desde cero
      openPlaylist = null;
    }
    updateConnection();
  });
  bus.on('nav:changed', ({ view }) => {
    if (view === 'youtube') updateConnection();
  });
  updateConnection();
}
