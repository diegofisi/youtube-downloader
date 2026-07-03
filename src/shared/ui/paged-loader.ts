// Shared "See more" pagination (My YouTube / Search): loadSeq anti-race (stale loads discarded),
// keyed dedupe append, "See more" button wiring. Views orchestrate page 1 via begin() + loadFirst().
import { $ } from './dom';
import { I } from './icons';
import { showToast } from './toast';
import { t } from '../../core/i18n';

export interface PagedResult<T> {
  items: T[];
  /** Raw entry count returned by the source; lets hasMore be computed when the
   * view filters client-side (Search). Defaults to items.length. */
  rawCount?: number;
}

export interface PagedLoaderOptions<T> {
  /** Page size; also the "may have more" threshold (full page). */
  pageSize: number;
  /** Cross-page dedupe key (the feed may shift between requests). */
  key: (item: T) => string;
  /** Fetches page [start, end] (1-based inclusive indices) of the current source. */
  fetchPage: (start: number, end: number) => Promise<PagedResult<T>>;
  /** Id of the "See more" button: the loader manages its click, disabled and spinner. */
  moreButtonId: string;
  /** Re-render after successfully appending a "See more" page. */
  onPage: () => void;
}

export interface PagedLoader<T> {
  /** Accumulated items (live reference; do not mutate from outside). */
  readonly items: T[];
  /** true if the last page came back full (there may be more). */
  readonly hasMore: boolean;
  /** New load: invalidates previous ones, clears items and returns its token. */
  begin(): number;
  /** Fetches and stores the first page of load `seq`. Returns 'stale' if begin() was called again
   * meanwhile (stale-load errors also become 'stale'); rethrows the error if the load is still live. */
  loadFirst(seq: number): Promise<'ok' | 'stale'>;
  /** Wires the "See more" button click (call once in the view's init). */
  wireMore(): void;
}

export function createPagedLoader<T>(opts: PagedLoaderOptions<T>): PagedLoader<T> {
  let items: T[] = [];
  /** Next 1-based index to request with "See more". */
  let nextStart = 1;
  let hasMore = false;
  let loadingMore = false;
  let loadSeq = 0;

  /** Appends a page, skipping duplicates (by key) in case the feed shifted. */
  function appendUnique(page: T[]): void {
    const known = new Set(items.map(opts.key));
    for (const it of page) {
      const k = opts.key(it);
      if (known.has(k)) continue;
      known.add(k);
      items.push(it);
    }
  }

  /** Stores a received page and advances the cursor/hasMore. */
  function accept(res: PagedResult<T>): void {
    nextStart += opts.pageSize;
    hasMore = (res.rawCount ?? res.items.length) >= opts.pageSize;
    appendUnique(res.items);
  }

  /** Loads the next page ("See more" button) and appends it to the grid. */
  async function loadMore(): Promise<void> {
    if (loadingMore || !hasMore) return;
    const seq = loadSeq; // if it changes (new source/search), the result is discarded
    loadingMore = true;
    const btn = $<HTMLButtonElement>(opts.moreButtonId);
    const prevHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `${I.spinner} ${t('Cargando…', 'Loading…')}`;
    try {
      const res = await opts.fetchPage(nextStart, nextStart + opts.pageSize - 1);
      if (seq !== loadSeq) return;
      accept(res);
      opts.onPage();
    } catch (e) {
      if (seq === loadSeq) showToast(t('No se pudieron cargar más', 'Could not load more'), String(e), 'error');
    } finally {
      loadingMore = false;
      btn.disabled = false;
      btn.innerHTML = prevHtml;
    }
  }

  return {
    get items() {
      return items;
    },
    get hasMore() {
      return hasMore;
    },
    begin() {
      items = [];
      nextStart = 1;
      hasMore = false;
      return ++loadSeq;
    },
    async loadFirst(seq) {
      try {
        const res = await opts.fetchPage(1, opts.pageSize);
        if (seq !== loadSeq) return 'stale';
        accept(res);
        return 'ok';
      } catch (e) {
        if (seq !== loadSeq) return 'stale';
        throw e;
      }
    },
    wireMore() {
      $(opts.moreButtonId).addEventListener('click', () => void loadMore());
    },
  };
}
