import { describe, it, expect } from 'vitest';
import { SearchChip, filterByChip, searchUrl } from './search-chips';

// Regression net replacing the vanilla paged-loader tests: the chip refinement is
// now the only client-side paging logic (React Query owns fetch/accumulate).

interface Row {
  url: string;
  duration?: number;
  is_playlist: boolean;
}

function vid(url: string, duration?: number): Row {
  return { url, duration, is_playlist: false };
}

function playlist(url: string): Row {
  return { url, is_playlist: true };
}

describe('filterByChip', () => {
  it('el chip "Todo" descarta playlists/canales pero conserva todos los videos', () => {
    const page = [vid('watch?v=a', 30), playlist('playlist?list=x'), vid('watch?v=b', 4000)];
    expect(filterByChip(page, SearchChip.Todo).map((v) => v.url)).toEqual(['watch?v=a', 'watch?v=b']);
  });

  it('el chip "Videos" también descarta playlists', () => {
    const page = [playlist('playlist?list=x'), vid('watch?v=a')];
    expect(filterByChip(page, SearchChip.Videos)).toHaveLength(1);
  });

  it('el chip "Shorts" conserva URLs /shorts/ sin importar la duración', () => {
    const page = [vid('https://youtube.com/shorts/abc', 4000), vid('watch?v=a', 4000)];
    expect(filterByChip(page, SearchChip.Shorts).map((v) => v.url)).toEqual(['https://youtube.com/shorts/abc']);
  });

  it('el chip "Shorts" acepta duración <= 180 s y rechaza 181 s', () => {
    const page = [vid('watch?v=a', 180), vid('watch?v=b', 181), vid('watch?v=c', 15)];
    expect(filterByChip(page, SearchChip.Shorts).map((v) => v.url)).toEqual(['watch?v=a', 'watch?v=c']);
  });

  it('el chip "Shorts" descarta videos sin duración y sin URL de shorts', () => {
    expect(filterByChip([vid('watch?v=a')], SearchChip.Shorts)).toHaveLength(0);
  });

  it('el chip "Shorts" descarta playlists aunque duren poco', () => {
    const page = [{ url: 'playlist?list=x', duration: 60, is_playlist: true }];
    expect(filterByChip(page, SearchChip.Shorts)).toHaveLength(0);
  });
});

describe('searchUrl', () => {
  it('codifica la consulta y añade el sp del chip', () => {
    expect(searchUrl('gatos graciosos', SearchChip.Todo)).toBe(
      'https://www.youtube.com/results?search_query=gatos%20graciosos',
    );
    expect(searchUrl('gatos', SearchChip.Videos)).toContain('&sp=EgIQAQ%3D%3D');
  });
});
