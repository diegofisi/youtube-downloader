import { describe, it, expect } from 'vitest';
import { findAnalyzeEntryError, parseAnalyzeEntryError } from './analyze-entry-error';

describe('parseAnalyzeEntryError', () => {
  it('distingue el prefijo de auth del genérico', () => {
    expect(parseAnalyzeEntryError('error:auth: cookies are no longer valid')).toEqual({
      message: 'cookies are no longer valid',
      auth: true,
    });
    expect(parseAnalyzeEntryError('error: Video unavailable')).toEqual({
      message: 'Video unavailable',
      auth: false,
    });
  });

  it('ignora disponibilidades normales y vacías', () => {
    expect(parseAnalyzeEntryError(undefined)).toBeNull();
    expect(parseAnalyzeEntryError('private')).toBeNull();
    expect(parseAnalyzeEntryError('subscriber_only')).toBeNull();
  });
});

describe('findAnalyzeEntryError', () => {
  it('devuelve el primer error sin id y salta videos y playlists válidos', () => {
    const entries = [
      { id: 'a', availability: 'error: not really', is_playlist: false },
      { id: '', availability: 'private', is_playlist: false },
      { id: '', availability: 'error:auth: Sign in to confirm', is_playlist: false },
    ];
    expect(findAnalyzeEntryError(entries)).toEqual({ message: 'Sign in to confirm', auth: true });
  });

  it('null cuando el lote no trae errores', () => {
    expect(findAnalyzeEntryError([{ id: 'a', is_playlist: false }])).toBeNull();
    expect(findAnalyzeEntryError([])).toBeNull();
  });
});
