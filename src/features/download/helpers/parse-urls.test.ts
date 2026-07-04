import { describe, it, expect } from 'vitest';
import { parseUrls, countLines, lineCountLabel, mergeLines } from './parse-urls';

// i18n defaults to 'es' with no localStorage: label expectations are Spanish.

describe('parseUrls', () => {
  it('conserva solo líneas que empiezan por http, recortadas', () => {
    const text = '  https://youtu.be/a  \nnota suelta\n\nhttp://x.com/b\nftp://no';
    expect(parseUrls(text)).toEqual(['https://youtu.be/a', 'http://x.com/b']);
  });

  it('texto vacío devuelve []', () => {
    expect(parseUrls('')).toEqual([]);
  });
});

describe('countLines', () => {
  it('cuenta solo líneas no vacías', () => {
    expect(countLines('a\n\n  \nb\nc')).toBe(3);
    expect(countLines('')).toBe(0);
  });
});

describe('lineCountLabel', () => {
  it('singular y plural en español', () => {
    expect(lineCountLabel(1)).toBe('1 línea');
    expect(lineCountLabel(2)).toBe('2 líneas');
    expect(lineCountLabel(0)).toBe('0 líneas');
  });
});

describe('mergeLines', () => {
  it('añade solo URLs nuevas al final, sin duplicar', () => {
    expect(mergeLines('u1\nu2', ['u2', 'u3'])).toBe('u1\nu2\nu3');
  });

  it('deduplica dentro del lote añadido y recorta espacios', () => {
    expect(mergeLines('u1', [' u2 ', 'u2', ''])).toBe('u1\nu2');
  });

  it('con textarea vacío devuelve solo las URLs', () => {
    expect(mergeLines('', ['u1', 'u2'])).toBe('u1\nu2');
  });
});
