import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadRecents, addRecentLinks, clearRecents } from './recent-links';

// Node env has no localStorage: stub a minimal in-memory implementation.
function mkStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

const KEY = 'stash.recentLinks';

beforeEach(() => {
  vi.stubGlobal('localStorage', mkStorage());
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-03T12:00:00Z'));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('loadRecents', () => {
  it('devuelve [] sin datos, con JSON corrupto o con un no-array', () => {
    expect(loadRecents()).toEqual([]);
    vi.stubGlobal('localStorage', mkStorage({ [KEY]: '{corrupto' }));
    expect(loadRecents()).toEqual([]);
    vi.stubGlobal('localStorage', mkStorage({ [KEY]: '{"a":1}' }));
    expect(loadRecents()).toEqual([]);
  });

  it('filtra entradas malformadas y conserva las válidas', () => {
    const raw = JSON.stringify([{ url: 'u1', ts: 1 }, { url: 42, ts: 2 }, { ts: 3 }, null]);
    vi.stubGlobal('localStorage', mkStorage({ [KEY]: raw }));
    expect(loadRecents()).toEqual([{ url: 'u1', ts: 1 }]);
  });
});

describe('addRecentLinks', () => {
  it('guarda con timestamp y los nuevos quedan primero', () => {
    addRecentLinks(['u1']);
    vi.setSystemTime(new Date('2026-07-03T13:00:00Z'));
    addRecentLinks(['u2']);
    const r = loadRecents();
    expect(r.map((x) => x.url)).toEqual(['u2', 'u1']);
    expect(r[0].ts).toBeGreaterThan(r[1].ts);
  });

  it('re-añadir una URL existente la deduplica y la sube al frente', () => {
    addRecentLinks(['u1', 'u2']);
    addRecentLinks(['u2']);
    expect(loadRecents().map((x) => x.url)).toEqual(['u2', 'u1']);
  });

  it('deduplica también dentro del mismo lote', () => {
    addRecentLinks(['u1', 'u1', 'u2']);
    expect(loadRecents().map((x) => x.url)).toEqual(['u1', 'u2']);
  });

  it('recorta el historial a 50 entradas', () => {
    addRecentLinks(Array.from({ length: 60 }, (_, i) => `u${i}`));
    const r = loadRecents();
    expect(r).toHaveLength(50);
    expect(r[0].url).toBe('u0');
    expect(r[49].url).toBe('u49');
  });

  it('un localStorage que lanza no rompe (cuota llena)', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceeded');
      },
      removeItem: () => {},
    });
    expect(() => addRecentLinks(['u1'])).not.toThrow();
  });
});

describe('clearRecents', () => {
  it('borra el historial persistido', () => {
    addRecentLinks(['u1']);
    clearRecents();
    expect(loadRecents()).toEqual([]);
  });
});
