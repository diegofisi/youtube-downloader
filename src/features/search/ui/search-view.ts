// "Search" view: yt-dlp over /results, mirroring account-view patterns (paged analyzeUrls, loadSeq,
// selection, per-card download menu). Chip strategy (empirically verified): see CHIP_SP below.
import { esc } from '../../../shared/lib/html';
import { bus } from '../../../core/bus/event-bus';
import { showToast } from '../../../shared/ui/toast';
import { $ } from '../../../shared/ui/dom';
import { closeAnchoredMenu } from '../../../shared/ui/anchored-menu';
import { videoCard, stateCard, loadingCard, wireVideoCards, renderPillBar } from '../../../shared/ui/media-card';
import { createPagedLoader } from '../../../shared/ui/paged-loader';
import { flatten, openDlMenu, downloadSelected, customizeSelected } from '../../../shared/ui/dl-actions';
import { analyzeUrls } from '../../preview';
import type { VideoMeta } from '../../preview';
import { t } from '../../../core/i18n';

const CHIPS = [
  { key: 'todo', label: t('Todo', 'All') },
  { key: 'videos', label: t('Videos', 'Videos') },
  { key: 'shorts', label: t('Shorts', 'Shorts') },
] as const;
type ChipKey = (typeof CHIPS)[number]['key'];

/** YouTube search `sp` per chip (already URL-encoded). "All" filters channels/playlists client-side;
 * no reliable Shorts-only sp exists and flat entries always use watch?v=, so Shorts refine client-side. */
const CHIP_SP: Record<ChipKey, string> = {
  todo: '',
  videos: '&sp=EgIQAQ%3D%3D', // Type: Video (server-side)
  shorts: '&sp=EgQQARgB', // Type: Video + duration < 4 min (refined client-side)
};
/** Shorts can currently last up to 3 minutes. */
const SHORTS_MAX_SECONDS = 180;

/** Page size for the "See more" pagination. */
const PAGE = 50;

let query = '';
let chip: ChipKey = 'todo';
const sel = new Set<string>();

function searchUrl(): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}${CHIP_SP[chip]}`;
}
/** Refines the page client-side per chip (see CHIP_SP note). */
function clientFilter(page: VideoMeta[]): VideoMeta[] {
  // All chips drop channels/playlists (YoutubeTab entries): only single videos
  // are downloadable here.
  const vids = page.filter((v) => !v.is_playlist);
  if (chip === 'shorts')
    return vids.filter((v) => v.url.includes('/shorts/') || (v.duration != null && v.duration <= SHORTS_MAX_SECONDS));
  return vids;
}

const loader = createPagedLoader<VideoMeta>({
  pageSize: PAGE,
  key: (v) => v.id || v.url,
  // rawCount: raw entry count (hasMore is decided before client-side filtering).
  fetchPage: async (start, end) => {
    const raw = flatten(await analyzeUrls([searchUrl()], { start, end }));
    return { items: clientFilter(raw), rawCount: raw.length };
  },
  moreButtonId: 'search-more',
  onPage: () => renderList(),
});

// ---------- render ----------
function renderChips(): void {
  renderPillBar($('search-chips'), CHIPS, chip, (key) => {
    chip = key as ChipKey;
    renderChips();
    if (query) void doSearch(); // re-search the current query with the new filter
  });
}

function renderList(): void {
  closeAnchoredMenu(); // the grid is re-rendered via innerHTML: the anchor node no longer exists
  const videos = loader.items;
  $('search-empty').hidden = true;
  $('search-count').textContent = videos.length
    ? `${videos.length} ${videos.length === 1 ? t('resultado', 'result') : t('resultados', 'results')}`
    : '';

  $('search-more-wrap').hidden = !loader.hasMore || videos.length === 0;

  const nSel = videos.filter((v) => sel.has(v.url)).length;
  const dlBtn = $('btn-search-download-sel');
  const custBtn = $('btn-search-custom-sel');
  dlBtn.hidden = nSel === 0;
  custBtn.hidden = nSel === 0;
  dlBtn.textContent = `${t('Descargar', 'Download')} ${nSel}`;

  $('search-list').innerHTML = videos.map((v) => videoCard(v, sel.has(v.url))).join('');

  wireVideoCards($('search-list'), videos, {
    toggle: (url) => {
      if (sel.has(url)) sel.delete(url);
      else sel.add(url);
      renderList();
    },
    download: openDlMenu,
  });
}

// ---------- loading ----------
async function doSearch(): Promise<void> {
  const q = $<HTMLInputElement>('search-input').value.trim();
  if (!q) {
    showToast(t('Escribe algo para buscar', 'Type something to search'), '', 'info');
    return;
  }
  query = q;
  closeAnchoredMenu();
  const seq = loader.begin();
  sel.clear();
  $('search-count').textContent = '';
  $('btn-search-download-sel').hidden = true;
  $('btn-search-custom-sel').hidden = true;
  $('search-more-wrap').hidden = true;
  $('search-empty').hidden = true;
  $('search-list').innerHTML = loadingCard(`${t('Buscando', 'Searching')} “${esc(query)}”…`);
  try {
    if ((await loader.loadFirst(seq)) === 'stale') return; // arrived late: another search is in flight
    if (loader.items.length === 0 && !loader.hasMore) {
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
    $('search-list').innerHTML = stateCard(t('No se pudo buscar', 'Search failed'), String(e));
  }
}

export function initSearch(): void {
  renderChips();
  $('btn-search-go').addEventListener('click', doSearch);
  $('search-input').addEventListener('keydown', (e) => {
    if ((e as KeyboardEvent).key === 'Enter') void doSearch();
  });
  loader.wireMore();
  $('btn-search-download-sel').addEventListener('click', () => {
    const items = loader.items.filter((v) => sel.has(v.url));
    downloadSelected(
      items,
      t(
        `${items.length} ${items.length === 1 ? 'video' : 'videos'} en proceso.`,
        `${items.length} ${items.length === 1 ? 'video' : 'videos'} in progress.`,
      ),
      () => {
        sel.clear();
        renderList();
      },
    );
  });
  $('btn-search-custom-sel').addEventListener('click', () =>
    customizeSelected(
      loader.items.filter((v) => sel.has(v.url)).map((v) => v.url),
      () => {
        sel.clear();
        renderList();
      },
    ),
  );
  bus.on('nav:changed', ({ view }) => {
    if (view === 'buscar') $('search-input').focus();
    else closeAnchoredMenu();
  });
}
