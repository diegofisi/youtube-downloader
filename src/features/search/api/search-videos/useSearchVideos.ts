import { useInfiniteQuery } from '@tanstack/react-query';
import { invoke } from '@/shared/lib/tauri';
import { filterByChip, SEARCH_PAGE_SIZE, searchUrl, type SearchChip } from '../../helpers/search-chips';
import type { SearchVideo } from '../../models/search-video.model';
import { flattenEntries, toSearchVideo, type AnalyzedEntryDTO, type VideoMetaDTO } from './search-videos.dto';

interface SearchPageDTO {
  videos: VideoMetaDTO[];
  /** Raw (pre-filter) flat count: hasMore must ignore the client-side chip filter. */
  rawCount: number;
}

/** Paged yt-dlp search over /results (local analyze_urls adapter). */
export function useSearchVideos(query: string, chip: SearchChip) {
  return useInfiniteQuery({
    queryKey: ['search', query, chip],
    enabled: query !== '',
    initialPageParam: 1,
    queryFn: async ({ pageParam }): Promise<SearchPageDTO> => {
      const raw = flattenEntries(
        await invoke<AnalyzedEntryDTO[]>('analyze_urls', {
          urls: [searchUrl(query, chip)],
          start: pageParam,
          end: pageParam + SEARCH_PAGE_SIZE - 1,
        }),
      );
      return { videos: filterByChip(raw, chip), rawCount: raw.length };
    },
    getNextPageParam: (last, all) =>
      last.rawCount >= SEARCH_PAGE_SIZE ? all.length * SEARCH_PAGE_SIZE + 1 : undefined,
    select: (data): SearchVideo[] => {
      // Cross-page dedupe by id/url: the results feed may shift between requests.
      const seen = new Set<string>();
      const out: SearchVideo[] = [];
      for (const v of data.pages.flatMap((p) => p.videos)) {
        const key = v.id || v.url;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(toSearchVideo(v));
      }
      return out;
    },
    // A search is a snapshot: "Buscar" re-submits explicitly (refetch), never in background.
    staleTime: Infinity,
  });
}
