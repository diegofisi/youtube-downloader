import { useInfiniteQuery } from '@tanstack/react-query';
import { invoke } from '@/shared/lib/tauri';
import type { FeedVideo } from '../../models/feed-video.model';
import { flattenEntries, toFeedVideo, type AnalyzedEntryDTO, type VideoMetaDTO } from './get-account-feed.dto';

export const FEED_PAGE_SIZE = 50;

interface FeedPageDTO {
  videos: VideoMetaDTO[];
}

/** Paged account feed via analyze_urls (local adapter).
 * keyDetail: ['youtube', tab] for tabs, ['youtube', 'playlists', url] for a drill-down. */
export function useAccountFeed(sourceUrl: string, keyDetail: readonly string[], enabled: boolean) {
  return useInfiniteQuery({
    queryKey: ['youtube', ...keyDetail],
    enabled,
    initialPageParam: 1,
    queryFn: async ({ pageParam }): Promise<FeedPageDTO> => {
      const videos = flattenEntries(
        await invoke<AnalyzedEntryDTO[]>('analyze_urls', {
          urls: [sourceUrl],
          start: pageParam,
          end: pageParam + FEED_PAGE_SIZE - 1,
        }),
      );
      return { videos };
    },
    getNextPageParam: (last, all) =>
      last.videos.length >= FEED_PAGE_SIZE ? all.length * FEED_PAGE_SIZE + 1 : undefined,
    select: (data): FeedVideo[] => {
      // Cross-page dedupe by id/url: the feed may shift between requests.
      const seen = new Set<string>();
      const out: FeedVideo[] = [];
      for (const v of data.pages.flatMap((p) => p.videos)) {
        const key = v.id || v.url;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(toFeedVideo(v));
      }
      return out;
    },
    // Feeds reload via ['youtube'] invalidation on session changes, not in background.
    staleTime: Infinity,
  });
}
