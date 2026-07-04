import { describe, it, expect } from 'vitest';
import { fmtDate } from './format';

// fmtDuration is an identical copy already pinned by the download slice's tests;
// only the library-only fmtDate is tested here.

describe('fmtDate', () => {
  it('incluye día de dos dígitos y hora:minuto en el idioma activo (es)', () => {
    const s = fmtDate(new Date(2026, 0, 5, 14, 30));
    expect(s).toContain('05');
    expect(s).toContain('14:30');
  });

  it('una fecha inválida no lanza (devuelve string)', () => {
    expect(typeof fmtDate(new Date(NaN))).toBe('string');
  });
});
