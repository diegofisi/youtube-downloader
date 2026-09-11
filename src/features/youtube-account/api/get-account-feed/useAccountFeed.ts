import { useInfiniteQuery } from '@tanstack/react-query';
import { findAnalyzeEntryError } from '@/shared/lib/analyze-entry-error';
import { invoke } from '@/shared/lib/tauri';
import { runWithSessionRetry, SessionAuthError } from '@/features/session';
import type { FeedVideo } from '../../models/feed-video.model';
import { flattenEntries, toFeedVideo, type AnalyzedEntryDTO, type VideoMetaDTO } from './get-account-feed.dto';

export const FEED_PAGE_SIZE = 50;

interface FeedPageDTO {
  videos: VideoMetaDTO[];
}

/** Paged account feed via analyze_urls (local adapter).
 * keyDetail: ['youtube', tab] for tabs, ['youtube', 'playlists', url] for a drill-down. */
export function useAccountFeed(sourceUrl: string, keyDetail: readonly string[], enabled: boolean) {
  const fetchPage = async (pageParam: number): Promise<AnalyzedEntryDTO[]> => {
    const entries = await invoke<AnalyzedEntryDTO[]>('analyze_urls', {
      urls: [sourceUrl],
      start: pageParam,
      end: pageParam + FEED_PAGE_SIZE - 1,
    });
    const err = findAnalyzeEntryError(entries);
    if (err) throw err.auth ? new SessionAuthError(err.message) : new Error(err.message);
    return entries;
  };

  return useInfiniteQuery({
    queryKey: ['youtube', ...keyDetail],
    enabled,
    initialPageParam: 1,
    queryFn: async ({ pageParam }): Promise<FeedPageDTO> => {
      // analyze_urls never rejects: a failed feed is an id-less error entry that
      // flattenEntries would drop, so surface it (and retry once on a dead session).
      const entries = await runWithSessionRetry(() => fetchPage(pageParam));
      return { videos: flattenEntries(entries) };
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
