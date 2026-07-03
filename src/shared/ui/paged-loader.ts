/**
 * Paginación "Ver más" compartida (Mi YouTube / Buscar). Encapsula el estado
 * nextStart/hasMore/loadingMore/loadSeq (anti-race: los resultados de cargas
 * viejas se descartan), el append sin duplicados por clave y el wiring/estado
 * de carga del botón "Ver más". La primera página la orquesta cada vista
 * (loading/vacío/error propios) con begin() + loadFirst().
 */
import { $ } from './dom';
import { I } from './icons';
import { showToast } from './toast';
import { t } from '../../core/i18n';

export interface PagedResult<T> {
  items: T[];
  /**
   * Nº de entradas crudas que devolvió la fuente. Permite calcular hasMore
   * cuando la vista filtra en cliente (Buscar); si se omite, se usa items.length.
   */
  rawCount?: number;
}

export interface PagedLoaderOptions<T> {
  /** Tamaño de página; también umbral de "puede haber más" (página llena). */
  pageSize: number;
  /** Clave de deduplicación entre páginas (el feed puede moverse entre peticiones). */
  key: (item: T) => string;
  /** Pide la página [start, end] (índices 1-based inclusivos) de la fuente actual. */
  fetchPage: (start: number, end: number) => Promise<PagedResult<T>>;
  /** id del botón "Ver más": el loader gestiona su click, disabled y spinner. */
  moreButtonId: string;
  /** Re-render tras añadir con éxito una página de "Ver más". */
  onPage: () => void;
}

export interface PagedLoader<T> {
  /** Items acumulados (referencia viva; no mutar desde fuera). */
  readonly items: T[];
  /** true si la última página vino llena (puede haber más). */
  readonly hasMore: boolean;
  /** Nueva carga: invalida las anteriores, vacía items y devuelve su token. */
  begin(): number;
  /**
   * Pide y acumula la primera página de la carga `seq`. Devuelve 'stale' si
   * begin() se llamó de nuevo mientras cargaba (los errores de cargas viejas
   * también se descartan como 'stale'); relanza el error si la carga sigue viva.
   */
  loadFirst(seq: number): Promise<'ok' | 'stale'>;
  /** Conecta el click del botón "Ver más" (llamar una vez en el init de la vista). */
  wireMore(): void;
}

export function createPagedLoader<T>(opts: PagedLoaderOptions<T>): PagedLoader<T> {
  let items: T[] = [];
  /** Siguiente índice 1-based a pedir con "Ver más". */
  let nextStart = 1;
  let hasMore = false;
  let loadingMore = false;
  let loadSeq = 0;

  /** Añade una página evitando duplicados (por clave) si el feed se movió. */
  function appendUnique(page: T[]): void {
    const known = new Set(items.map(opts.key));
    for (const it of page) {
      const k = opts.key(it);
      if (known.has(k)) continue;
      known.add(k);
      items.push(it);
    }
  }

  /** Acumula una página recibida y avanza el cursor/hasMore. */
  function accept(res: PagedResult<T>): void {
    nextStart += opts.pageSize;
    hasMore = (res.rawCount ?? res.items.length) >= opts.pageSize;
    appendUnique(res.items);
  }

  /** Carga la siguiente página (botón "Ver más") y la añade al grid. */
  async function loadMore(): Promise<void> {
    if (loadingMore || !hasMore) return;
    const seq = loadSeq; // si cambia (otra fuente/búsqueda), se descarta el resultado
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
      if (seq === loadSeq)
        showToast(t('No se pudieron cargar más', 'Could not load more'), String(e), 'error');
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
