import { t } from '@/shared/lib/messages/t';

export const SearchChip = {
  Todo: 'todo',
  Videos: 'videos',
  Shorts: 'shorts',
} as const;
export type SearchChip = (typeof SearchChip)[keyof typeof SearchChip];

/** Labels resolve at call time so language switches re-evaluate them. */
export function searchChipOptions(): { value: SearchChip; label: string }[] {
  return [
    { value: SearchChip.Todo, label: t.search.chipAll() },
    { value: SearchChip.Videos, label: t.search.chipVideos() },
    { value: SearchChip.Shorts, label: t.search.chipShorts() },
  ];
}

export function searchChipLabel(chip: SearchChip): string {
  return searchChipOptions().find((c) => c.value === chip)?.label ?? chip;
}

/** YouTube search `sp` per chip (already URL-encoded). "All" filters channels/playlists client-side;
 * no reliable Shorts-only sp exists and flat entries always use watch?v=, so Shorts refine client-side. */
const CHIP_SP: Record<SearchChip, string> = {
  todo: '',
  videos: '&sp=EgIQAQ%3D%3D', // Type: Video (server-side)
  shorts: '&sp=EgQQARgB', // Type: Video + duration < 4 min (refined client-side)
};

/** Shorts can currently last up to 3 minutes. */
const SHORTS_MAX_SECONDS = 180;

export const SEARCH_PAGE_SIZE = 50;

export function searchUrl(query: string, chip: SearchChip): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}${CHIP_SP[chip]}`;
}

/** Client-side chip refinement — see CHIP_SP note for why. */
export function filterByChip<T extends { url: string; duration?: number; is_playlist: boolean }>(
  page: T[],
  chip: SearchChip,
): T[] {
  // Only single videos are downloadable; drop channels/playlists.
  const vids = page.filter((v) => !v.is_playlist);
  if (chip === SearchChip.Shorts) {
    return vids.filter((v) => v.url.includes('/shorts/') || (v.duration != null && v.duration <= SHORTS_MAX_SECONDS));
  }
  return vids;
}
