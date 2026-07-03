/**
 * Vista "Buscar": busca videos en YouTube (yt-dlp sobre /results) y permite
 * descargarlos sin salir de la app. Calca los patrones de account-view:
 * paginación con --playlist-items vía analyzeUrls, loadSeq, selección y
 * mini-menú "Descargar / Descarga personalizada" por tarjeta.
 *
 * Estrategia por chip (verificada empíricamente con el yt-dlp de la app):
 * - Todo:   /results?search_query=Q                → todo tipo; se filtran
 *           canales/playlists en cliente (is_playlist) porque no son descargables
 *           como video suelto.
 * - Videos: &sp=EgIQAQ%3D%3D (filtro "Tipo: Video") → solo videos, server-side.
 * - Shorts: &sp=EgQQARgB (Video + duración <4 min)  → no existe sp fiable solo
 *           para Shorts y las entradas planas siempre traen url watch?v= (nunca
 *           /shorts/), así que se afina en cliente con duración ≤ 180 s.
 */
import { I } from '../../../shared/ui/icons';
import { esc } from '../../../shared/lib/html';
import { bus } from '../../../core/bus/event-bus';
import { showToast } from '../../../shared/ui/toast';
import { $ } from '../../../shared/ui/dom';
import { fmtDuration } from '../../../shared/lib/format';
import { CARD_GRAD } from '../../../shared/ui/gradients';
import { openAnchoredMenu, closeAnchoredMenu } from '../../../shared/ui/anchored-menu';
import { analyzeUrls } from '../../preview';
import type { AnalyzedEntry, VideoMeta, PlaylistMeta } from '../../preview';
import { enqueue } from '../../queue';
import { getCookieMode } from '../../session';
import type { DownloadOptions } from '../../download';
import { t } from '../../../core/i18n';

const CHIPS = [
  { key: 'todo', label: t('Todo', 'All') },
  { key: 'videos', label: t('Videos', 'Videos') },
  { key: 'shorts', label: t('Shorts', 'Shorts') },
] as const;
type ChipKey = (typeof CHIPS)[number]['key'];

/** sp del buscador de YouTube por chip (ya URL-encoded para pegar a la query). */
const CHIP_SP: Record<ChipKey, string> = {
  todo: '',
  videos: '&sp=EgIQAQ%3D%3D', // Tipo: Video
  shorts: '&sp=EgQQARgB', // Tipo: Video + duración < 4 min (se afina en cliente)
};
/** Shorts hoy pueden durar hasta 3 minutos. */
const SHORTS_MAX_SECONDS = 180;

/** Tamaño de página para la paginación con "Ver más". */
const PAGE = 50;

let query = '';
let chip: ChipKey = 'todo';
let loadSeq = 0;
const sel = new Set<string>();
let videos: VideoMeta[] = [];
/** Siguiente índice 1-based a pedir con "Ver más". */
let nextStart = 1;
/** true si la última página vino llena (puede haber más). */
let hasMore = false;
let loadingMore = false;

function flatten(entries: AnalyzedEntry[]): VideoMeta[] {
  const out: VideoMeta[] = [];
  for (const e of entries) {
    if (e.is_playlist && 'entries' in e) out.push(...(e as PlaylistMeta).entries);
    else out.push(e as VideoMeta);
  }
  return out.filter((v) => v.id);
}
function searchUrl(): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}${CHIP_SP[chip]}`;
}
/** Afina la página en cliente según el chip (ver cabecera del archivo). */
function clientFilter(page: VideoMeta[]): VideoMeta[] {
  // En todos los chips descartamos canales/playlists (entradas YoutubeTab):
  // aquí solo se descargan videos sueltos.
  const vids = page.filter((v) => !v.is_playlist);
  if (chip === 'shorts')
    return vids.filter(
      (v) => v.url.includes('/shorts/') || (v.duration != null && v.duration <= SHORTS_MAX_SECONDS),
    );
  return vids;
}
/** Pide una página [start, start+PAGE-1] de la búsqueda, aplanada y filtrada. */
async function fetchPage(start: number): Promise<{ page: VideoMeta[]; rawCount: number }> {
  const entries = await analyzeUrls([searchUrl()], { start, end: start + PAGE - 1 });
  const raw = flatten(entries);
  return { page: clientFilter(raw), rawCount: raw.length };
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

// ---------- render ----------
function renderChips(): void {
  $('search-chips').innerHTML = CHIPS.map((c) => {
    const on = chip === c.key;
    return `<button data-chip="${c.key}" style="padding:7px 14px;border-radius:9px;font-size:12.5px;font-weight:600;border:1.5px solid ${
      on ? 'var(--accent)' : 'var(--border)'
    };background:${on ? 'var(--accentSoft)' : 'transparent'};color:${on ? 'var(--accent)' : 'var(--text2)'}">${c.label}</button>`;
  }).join('');
  $('search-chips')
    .querySelectorAll<HTMLElement>('[data-chip]')
    .forEach((b) =>
      b.addEventListener('click', () => {
        if (chip === b.dataset.chip) return;
        chip = b.dataset.chip as ChipKey;
        renderChips();
        if (query) doSearch(); // re-busca la query actual con el nuevo filtro
      }),
    );
}

function checkOverlay(on: boolean): string {
  return `<button class="sr-check" style="position:absolute;top:8px;left:8px;width:24px;height:24px;border-radius:7px;display:flex;align-items:center;justify-content:center;border:1.8px solid ${
    on ? 'var(--accent)' : 'rgba(255,255,255,.7)'
  };background:${on ? 'var(--accent)' : 'rgba(0,0,0,.4)'};color:#fff;backdrop-filter:blur(4px)">${on ? I.check : ''}</button>`;
}

function stateCard(title: string, msg: string): string {
  return `<div style="grid-column:1/-1;text-align:center;padding:50px 20px;border:1.5px dashed var(--border2);border-radius:16px;color:var(--text3)">
    <div style="font-size:14px;font-weight:600;color:var(--text2)">${esc(title)}</div>
    <div style="font-size:12.5px;margin-top:5px">${esc(msg)}</div>
  </div>`;
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
      <button class="sr-dl" title="${t('Descargar', 'Download')}" style="position:absolute;top:8px;right:8px;width:30px;height:30px;border-radius:8px;background:rgba(0,0,0,.6);color:#fff;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)">${I.download}</button>
      ${v.duration ? `<span style="position:absolute;bottom:8px;right:8px;background:rgba(0,0,0,.78);color:#fff;font-size:10.5px;font-weight:600;padding:1.5px 5px;border-radius:5px;font-family:'JetBrains Mono',monospace">${fmtDuration(v.duration)}</span>` : ''}
    </div>
    <div style="padding:10px 11px 12px">
      <div style="font-weight:600;font-size:12.5px;line-height:1.35;color:var(--text);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:34px">${esc(v.title)}</div>
      <div style="font-size:11.5px;color:var(--text2);margin-top:5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(v.channel)}</div>
    </div>
  </div>`;
}

function renderList(): void {
  closeAnchoredMenu(); // el grid se re-renderiza con innerHTML: el ancla deja de existir
  $('search-empty').hidden = true;
  $('search-count').textContent = videos.length
    ? `${videos.length} ${videos.length === 1 ? t('resultado', 'result') : t('resultados', 'results')}`
    : '';

  $('search-more-wrap').hidden = !hasMore || videos.length === 0;

  const nSel = videos.filter((v) => sel.has(v.url)).length;
  const dlBtn = $('btn-search-download-sel');
  const custBtn = $('btn-search-custom-sel');
  dlBtn.hidden = nSel === 0;
  custBtn.hidden = nSel === 0;
  dlBtn.textContent = `${t('Descargar', 'Download')} ${nSel}`;

  $('search-list').innerHTML = videos.map(videoCard).join('');

  $('search-list')
    .querySelectorAll<HTMLElement>('[data-url]')
    .forEach((card) => {
      const url = card.dataset.url!;
      const v = videos.find((x) => x.url === url)!;
      card.querySelector('.sr-check')?.addEventListener('click', (e) => {
        e.stopPropagation();
        sel.has(url) ? sel.delete(url) : sel.add(url);
        renderList();
      });
      card.querySelector('.sr-dl')?.addEventListener('click', (e) => {
        e.stopPropagation();
        openDlMenu(e.currentTarget as HTMLElement, v);
      });
    });
}

// ---------- carga ----------
async function doSearch(): Promise<void> {
  const q = $<HTMLInputElement>('search-input').value.trim();
  if (!q) {
    showToast(t('Escribe algo para buscar', 'Type something to search'), '', 'info');
    return;
  }
  query = q;
  const seq = ++loadSeq;
  closeAnchoredMenu();
  sel.clear();
  videos = [];
  nextStart = 1;
  hasMore = false;
  $('search-count').textContent = '';
  $('btn-search-download-sel').hidden = true;
  $('btn-search-custom-sel').hidden = true;
  $('search-more-wrap').hidden = true;
  $('search-empty').hidden = true;
  $('search-list').innerHTML = `<div style="grid-column:1/-1;display:flex;align-items:center;justify-content:center;gap:9px;padding:40px;color:var(--text2);font-size:13px">${I.spinner} ${t('Buscando', 'Searching')} “${esc(query)}”…</div>`;
  try {
    const { page, rawCount } = await fetchPage(1);
    if (seq !== loadSeq) return; // llegó tarde: hay otra búsqueda en curso
    appendUnique(page);
    hasMore = rawCount >= PAGE;
    nextStart = 1 + PAGE;
    if (videos.length === 0 && !hasMore) {
      const chipLabel = CHIPS.find((c) => c.key === chip)!.label;
      $('search-list').innerHTML = stateCard(
        t('Sin resultados', 'No results'),
        t(
          `No se encontró nada para “${query}” con el filtro ${chipLabel}.`,
          `Nothing found for “${query}” with the ${chipLabel} filter.`,
        ),
      );
      return;
    }
    renderList();
  } catch (e) {
    if (seq !== loadSeq) return;
    $('search-list').innerHTML = stateCard(t('No se pudo buscar', 'Search failed'), String(e));
  }
}

/** Carga la siguiente página (paginación "Ver más") y la añade al grid. */
async function loadMore(): Promise<void> {
  if (loadingMore || !hasMore) return;
  const seq = loadSeq; // si cambia (otra búsqueda/chip), se descarta el resultado
  loadingMore = true;
  const btn = $<HTMLButtonElement>('search-more');
  const prevHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `${I.spinner} ${t('Cargando…', 'Loading…')}`;
  try {
    const { page, rawCount } = await fetchPage(nextStart);
    if (seq !== loadSeq) return;
    nextStart += PAGE;
    hasMore = rawCount >= PAGE;
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

export function initSearch(): void {
  renderChips();
  $('btn-search-go').addEventListener('click', doSearch);
  $('search-input').addEventListener('keydown', (e) => {
    if ((e as KeyboardEvent).key === 'Enter') doSearch();
  });
  $('search-more').addEventListener('click', loadMore);
  $('btn-search-download-sel').addEventListener('click', () => {
    const items = videos.filter((v) => sel.has(v.url));
    if (!items.length) return;
    enqueue(items.map(toQueueItem));
    sel.clear();
    renderList();
    bus.emit('nav:goto', { view: 'cola' });
    showToast(
      t('Añadido a la cola', 'Added to queue'),
      t(
        `${items.length} ${items.length === 1 ? 'video' : 'videos'} en proceso.`,
        `${items.length} ${items.length === 1 ? 'video' : 'videos'} in progress.`,
      ),
      'done',
    );
  });
  $('btn-search-custom-sel').addEventListener('click', () => {
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
  bus.on('nav:changed', ({ view }) => {
    if (view === 'buscar') $('search-input').focus();
    else closeAnchoredMenu();
  });
}
