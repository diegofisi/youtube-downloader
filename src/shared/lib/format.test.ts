import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fmtDuration, fmtSize, timeAgo } from './format';

// Nota: i18n cae a 'es' cuando localStorage está vacío/no disponible, así que
// las cadenas esperadas de timeAgo son las españolas.

describe('fmtDuration', () => {
  it('devuelve cadena vacía para 0 o undefined', () => {
    expect(fmtDuration(0)).toBe('');
    expect(fmtDuration(undefined)).toBe('');
  });

  it('formatea menos de una hora como "m:ss"', () => {
    expect(fmtDuration(5)).toBe('0:05');
    expect(fmtDuration(65)).toBe('1:05');
    expect(fmtDuration(599)).toBe('9:59');
    expect(fmtDuration(3599)).toBe('59:59');
  });

  it('formatea una hora o más como "h:mm:ss"', () => {
    expect(fmtDuration(3600)).toBe('1:00:00');
    expect(fmtDuration(3725)).toBe('1:02:05');
    expect(fmtDuration(7 * 3600 + 8 * 60 + 9)).toBe('7:08:09');
  });

  it('trunca los segundos fraccionarios', () => {
    expect(fmtDuration(59.9)).toBe('0:59');
  });
});

describe('fmtSize', () => {
  it('devuelve "—" para 0', () => {
    expect(fmtSize(0)).toBe('—');
  });

  it('redondea megabytes por debajo de 1 GB', () => {
    expect(fmtSize(500)).toBe('500 MB');
    expect(fmtSize(499.6)).toBe('500 MB');
    expect(fmtSize(1023)).toBe('1023 MB');
  });

  it('pasa a GB con un decimal desde 1024 MB', () => {
    expect(fmtSize(1024)).toBe('1.0 GB');
    expect(fmtSize(1536)).toBe('1.5 GB');
  });

  it('quita el decimal a partir de 10 GB', () => {
    expect(fmtSize(10240)).toBe('10 GB');
    expect(fmtSize(15872)).toBe('16 GB');
  });
});

describe('timeAgo', () => {
  const AHORA = new Date('2026-07-03T12:00:00Z').getTime();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(AHORA);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('menos de un minuto es "ahora"', () => {
    expect(timeAgo(AHORA)).toBe('ahora');
    expect(timeAgo(AHORA - 59_000)).toBe('ahora');
  });

  it('de 1 a 59 minutos usa "hace X min"', () => {
    expect(timeAgo(AHORA - 60_000)).toBe('hace 1 min');
    expect(timeAgo(AHORA - 59 * 60_000)).toBe('hace 59 min');
  });

  it('de 1 a 23 horas usa "hace X h"', () => {
    expect(timeAgo(AHORA - 60 * 60_000)).toBe('hace 1 h');
    expect(timeAgo(AHORA - 23 * 60 * 60_000)).toBe('hace 23 h');
  });

  it('desde 24 horas usa "hace X d"', () => {
    expect(timeAgo(AHORA - 24 * 60 * 60_000)).toBe('hace 1 d');
    expect(timeAgo(AHORA - 72 * 60 * 60_000)).toBe('hace 3 d');
  });

  it('un timestamp futuro no da negativos', () => {
    expect(timeAgo(AHORA + 999_999)).toBe('ahora');
  });
});
