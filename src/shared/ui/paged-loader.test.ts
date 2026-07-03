// @vitest-environment jsdom
// El loader cablea un botón "Ver más" real; jsdom aporta el document mínimo.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPagedLoader, type PagedResult } from './paged-loader';

const mocks = vi.hoisted(() => ({ showToast: vi.fn() }));
vi.mock('./toast', () => ({ showToast: mocks.showToast }));

interface Item {
  id: string;
}
const items = (...ids: string[]): Item[] => ids.map((id) => ({ id }));
const pagina = (ids: string[], rawCount?: number): PagedResult<Item> => ({ items: items(...ids), rawCount });

function mkLoader(fetchPage: (start: number, end: number) => Promise<PagedResult<Item>>, pageSize = 3) {
  return createPagedLoader<Item>({
    pageSize,
    key: (it) => it.id,
    fetchPage,
    moreButtonId: 'btn-more',
    onPage: vi.fn(),
  });
}

async function flush(): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));
}

beforeEach(() => {
  mocks.showToast.mockReset();
  document.body.innerHTML = '<button id="btn-more">Ver más</button>';
});

describe('begin() (anti-race)', () => {
  it('invalida una carga anterior: su resultado se descarta como stale', async () => {
    let resuelveVieja!: (r: PagedResult<Item>) => void;
    const fetchPage = vi
      .fn()
      .mockReturnValueOnce(new Promise<PagedResult<Item>>((r) => (resuelveVieja = r)))
      .mockResolvedValue(pagina(['nuevo1']));
    const loader = mkLoader(fetchPage);

    const seqVieja = loader.begin();
    const promesaVieja = loader.loadFirst(seqVieja);

    const seqNueva = loader.begin(); // el usuario cambió de fuente/búsqueda
    resuelveVieja(pagina(['viejo1', 'viejo2', 'viejo3']));

    expect(await promesaVieja).toBe('stale');
    expect(loader.items).toHaveLength(0); // nada de la carga vieja se cuela

    expect(await loader.loadFirst(seqNueva)).toBe('ok');
    expect(loader.items.map((i) => i.id)).toEqual(['nuevo1']);
  });

  it('el error de una carga vieja también se descarta como stale (sin lanzar)', async () => {
    let rechazaVieja!: (e: Error) => void;
    const fetchPage = vi.fn().mockReturnValueOnce(new Promise<PagedResult<Item>>((_r, rej) => (rechazaVieja = rej)));
    const loader = mkLoader(fetchPage);

    const seqVieja = loader.begin();
    const promesa = loader.loadFirst(seqVieja);
    loader.begin();
    rechazaVieja(new Error('red caída'));

    expect(await promesa).toBe('stale');
  });

  it('el error de la carga viva sí se relanza', async () => {
    const loader = mkLoader(vi.fn().mockRejectedValue(new Error('red caída')));
    const seq = loader.begin();
    await expect(loader.loadFirst(seq)).rejects.toThrow('red caída');
  });

  it('begin() vacía los items acumulados', async () => {
    const loader = mkLoader(vi.fn().mockResolvedValue(pagina(['a', 'b', 'c'])));
    await loader.loadFirst(loader.begin());
    expect(loader.items).toHaveLength(3);
    loader.begin();
    expect(loader.items).toHaveLength(0);
  });
});

describe('hasMore', () => {
  it('página llena → puede haber más', async () => {
    const loader = mkLoader(vi.fn().mockResolvedValue(pagina(['a', 'b', 'c'])), 3);
    await loader.loadFirst(loader.begin());
    expect(loader.hasMore).toBe(true);
  });

  it('página corta → no hay más', async () => {
    const loader = mkLoader(vi.fn().mockResolvedValue(pagina(['a'])), 3);
    await loader.loadFirst(loader.begin());
    expect(loader.hasMore).toBe(false);
  });

  it('con rawCount manda el crudo, no el filtrado (la vista filtra en cliente)', async () => {
    // La fuente devolvió 3 crudos pero el filtro dejó 1: puede haber más.
    const loader = mkLoader(vi.fn().mockResolvedValue(pagina(['a'], 3)), 3);
    await loader.loadFirst(loader.begin());
    expect(loader.hasMore).toBe(true);
  });
});

describe('appendUnique y "Ver más"', () => {
  it('dedupea por clave cuando el feed se movió entre páginas', async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce(pagina(['a', 'b', 'c']))
      .mockResolvedValueOnce(pagina(['b', 'c', 'd'])); // el feed se corrió 1
    const loader = mkLoader(fetchPage, 3);
    loader.wireMore();
    await loader.loadFirst(loader.begin());

    document.getElementById('btn-more')!.click();
    await flush();

    expect(loader.items.map((i) => i.id)).toEqual(['a', 'b', 'c', 'd']);
    // La segunda página se pidió con el cursor avanzado (1-based inclusivo).
    expect(fetchPage).toHaveBeenNthCalledWith(2, 4, 6);
  });

  it('"Ver más" no hace nada si no hay más páginas', async () => {
    const fetchPage = vi.fn().mockResolvedValue(pagina(['a']));
    const loader = mkLoader(fetchPage, 3);
    loader.wireMore();
    await loader.loadFirst(loader.begin());
    expect(loader.hasMore).toBe(false);

    document.getElementById('btn-more')!.click();
    await flush();
    expect(fetchPage).toHaveBeenCalledTimes(1); // solo la primera página
  });

  it('si "Ver más" falla con la carga viva, avisa con un toast de error', async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce(pagina(['a', 'b', 'c']))
      .mockRejectedValueOnce(new Error('sin red'));
    const loader = mkLoader(fetchPage, 3);
    loader.wireMore();
    await loader.loadFirst(loader.begin());

    document.getElementById('btn-more')!.click();
    await flush();

    expect(mocks.showToast).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('sin red'), 'error');
    expect(loader.items).toHaveLength(3); // no se añadió nada
  });
});
