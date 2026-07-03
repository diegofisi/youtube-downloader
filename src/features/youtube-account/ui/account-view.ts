import { I } from '../../../shared/ui/icons';
import { esc } from '../../../shared/lib/html';
import { bus } from '../../../core/bus/event-bus';
import { $ } from '../../../shared/ui/dom';
import { closeAnchoredMenu } from '../../../shared/ui/anchored-menu';
import { videoCard, stateCard, loadingCard, wireVideoCards, renderPillBar } from '../../../shared/ui/media-card';
import { createPagedLoader } from '../../../shared/ui/paged-loader';
import { flatten, openDlMenu, downloadSelected, customizeSelected } from '../../../shared/ui/dl-actions';
import { analyzeUrls } from '../../preview';
import type { VideoMeta } from '../../preview';
import { isConnected, refreshSession } from '../../session';
import { t } from '../../../core/i18n';
import { initAccountCard, invalidateAccountInfo, renderAccountCard, updateConnection, openLogin } from './account-card';

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

/** Page size for the "See more" pagination. */
const PAGE = 50;

let tab = 'wl';
const sel = new Set<string>();
/** Playlist opened inside the "Playlists" tab (null = playlist grid). */
let openPlaylist: { url: string; title: string } | null = null;

/** Current source: the active tab, or the playlist opened inside "Playlists". */
function currentSource(): { url: string; label: string } {
  if (tab === 'playlists' && openPlaylist) return { url: openPlaylist.url, label: openPlaylist.title };
  const cur = TABS.find((t) => t.key === tab)!;
  return { url: cur.url, label: cur.label };
}
/** Are we showing the playlist grid (not its videos)? */
function inPlaylistGrid(): boolean {
  return tab === 'playlists' && !openPlaylist;
}

const loader = createPagedLoader<VideoMeta>({
  pageSize: PAGE,
  key: (v) => v.id || v.url,
  fetchPage: async (start, end) => ({
    items: flatten(await analyzeUrls([currentSource().url], { start, end })),
  }),
  moreButtonId: 'yt-more',
  onPage: () => renderList(),
});

function renderBenefits(): void {
  $('yt-benefits').innerHTML = BENEFITS.map(
    (
      b,
    ) => `<div style="display:flex;align-items:center;gap:11px;padding:12px 14px;background:var(--panel);border:1px solid var(--border);border-radius:11px">
      <span style="width:26px;height:26px;flex:none;border-radius:8px;display:flex;align-items:center;justify-content:center;background:var(--successSoft);color:var(--success)">${I.check}</span>
      <span style="font-size:13px;color:var(--text)">${esc(b)}</span></div>`,
  ).join('');
}

function renderTabs(): void {
  renderPillBar($('yt-tabs'), TABS, tab, (key) => {
    tab = key;
    openPlaylist = null;
    renderTabs();
    void loadTab();
  });
}

/** Empty/error state; with `showReconnect` adds the "Sign in again" button. */
function emptyState(title: string, msg: string, showReconnect: boolean): string {
  return stateCard(
    title,
    msg,
    showReconnect
      ? `<button id="yt-empty-reconnect" class="acc-btn" style="margin-top:16px;height:38px;padding:0 18px;border-radius:10px;background:var(--accent);color:var(--accentText);font-weight:600;font-size:13px">${t('Volver a iniciar sesión', 'Sign in again')}</button>`
      : '',
  );
}
function wireEmptyReconnect(): void {
  document.getElementById('yt-empty-reconnect')?.addEventListener('click', openLogin);
}

/** "← Back to Playlists" button (only inside an opened playlist). */
function backBtnHtml(): string {
  if (!openPlaylist) return '';
  return `<div style="grid-column:1/-1"><button id="yt-back" style="display:inline-flex;align-items:center;gap:7px;height:32px;padding:0 14px;border-radius:9px;border:1px solid var(--border2);background:var(--panel);color:var(--text2);font-weight:600;font-size:12.5px">${t('← Volver a Playlists', '← Back to Playlists')}</button></div>`;
}
function wireBack(): void {
  document.getElementById('yt-back')?.addEventListener('click', () => {
    openPlaylist = null;
    void loadTab();
  });
}

/** Playlist card ("Playlists" tab): own styling, opens on click. */
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
  closeAnchoredMenu(); // the grid is re-rendered via innerHTML: the anchor node no longer exists
  const src = currentSource();
  const plGrid = inPlaylistGrid();
  const videos = loader.items;
  $('yt-title').textContent = src.label;

  const noun = plGrid ? t('playlists', 'playlists') : t('videos', 'videos');
  $('yt-count').textContent = videos.length ? `${videos.length} ${noun}` : '';

  $('yt-more-wrap').hidden = !loader.hasMore || videos.length === 0;

  const nSel = videos.filter((v) => sel.has(v.url)).length;
  const dlBtn = $('btn-yt-download-sel');
  dlBtn.hidden = nSel === 0 || plGrid;
  dlBtn.textContent = `${t('Descargar', 'Download')} ${nSel}`;
  const custBtn = document.getElementById('btn-yt-customize-sel');
  if (custBtn) custBtn.hidden = dlBtn.hidden;

  $('yt-list').innerHTML =
    backBtnHtml() +
    (plGrid ? videos.map(playlistCard).join('') : videos.map((v) => videoCard(v, sel.has(v.url))).join(''));
  wireBack();

  if (plGrid) {
    $('yt-list')
      .querySelectorAll<HTMLElement>('[data-plurl]')
      .forEach((card) => {
        card.addEventListener('click', () => {
          const v = videos.find((x) => x.url === card.dataset.plurl);
          if (!v) return;
          openPlaylist = { url: v.url, title: v.title };
          void loadTab();
        });
      });
    return;
  }

  wireVideoCards($('yt-list'), videos, {
    toggle: (url) => {
      if (sel.has(url)) sel.delete(url);
      else sel.add(url);
      renderList();
    },
    download: openDlMenu,
  });
}

async function loadTab(): Promise<void> {
  closeAnchoredMenu();
  const src = currentSource();
  const seq = loader.begin();
  sel.clear();
  // Correct title/count from the start of the load (previously the old one lingered).
  $('yt-title').textContent = src.label;
  $('yt-count').textContent = '';
  $('btn-yt-download-sel').hidden = true;
  const custBtn = document.getElementById('btn-yt-customize-sel');
  if (custBtn) custBtn.hidden = true;
  $('yt-more-wrap').hidden = true;
  $('yt-list').innerHTML = backBtnHtml() + loadingCard(`${t('Cargando', 'Loading')} ${esc(src.label)}…`);
  wireBack();
  try {
    if ((await loader.loadFirst(seq)) === 'stale') return; // tab/playlist changed while loading
    if (loader.items.length === 0) {
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
      $('yt-list').innerHTML = backBtnHtml() + emptyState(t('No se pudo cargar', 'Could not load'), msg, false);
    }
    wireBack();
  }
}

export function initAccount(): void {
  initAccountCard({
    // After updateConnection with an active session: load the grid if empty.
    onLoggedIn: () => {
      if (loader.items.length === 0) void loadTab();
    },
    // After logout: clear grid state.
    onLoggedOut: () => {
      loader.begin();
      sel.clear();
      openPlaylist = null;
    },
  });
  renderBenefits();
  renderTabs();
  loader.wireMore();

  // Secondary "Customize" button next to "Download selected" (created here to
  // avoid touching index.html): sends the chosen urls to the Download view.
  const custBtn = document.createElement('button');
  custBtn.id = 'btn-yt-customize-sel';
  custBtn.className = 'acc-btn';
  custBtn.hidden = true;
  custBtn.textContent = t('Personalizar', 'Customize');
  custBtn.style.cssText =
    'height:34px;padding:0 15px;border-radius:9px;border:1.5px solid var(--border2);background:transparent;color:var(--text2);font-weight:600;font-size:12.5px';
  $('btn-yt-download-sel').insertAdjacentElement('afterend', custBtn);
  custBtn.addEventListener('click', () =>
    customizeSelected(
      loader.items.filter((v) => sel.has(v.url)).map((v) => v.url),
      () => {
        sel.clear();
        renderList();
      },
    ),
  );

  $('btn-yt-download-sel').addEventListener('click', () => {
    const items = loader.items.filter((v) => sel.has(v.url));
    downloadSelected(items, t(`${items.length} videos en proceso.`, `${items.length} videos in progress.`), () => {
      sel.clear();
      renderList();
    });
  });
  // Single path: session:changed covers all transitions (session:connected always
  // comes with session:changed, avoiding two concurrent loadTab calls).
  bus.on('session:changed', () => {
    // Any transition (logout, reconnect, expiry) invalidates the cached account
    // info; it is re-fetched only if the session ends up connected.
    invalidateAccountInfo();
    if (isConnected()) {
      loader.begin(); // on connect, reload the list from scratch
      openPlaylist = null;
    }
    void updateConnection();
  });
  bus.on('nav:changed', ({ view }) => {
    if (view === 'youtube') void updateConnection();
  });
  void updateConnection();
}
