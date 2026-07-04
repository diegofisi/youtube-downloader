import { t } from '@/shared/lib/i18n';

export const SearchChip = {
  Todo: 'todo',
  Videos: 'videos',
  Shorts: 'shorts',
} as const;
export type SearchChip = (typeof SearchChip)[keyof typeof SearchChip];

/** Labels resolve at call time so language switches re-evaluate them. */
export function searchChipOptions(): { value: SearchChip; label: string }[] {
  return [
    { value: SearchChip.Todo, label: t('Todo', 'All') },
    { value: SearchChip.Videos, label: t('Videos', 'Videos') },
    { value: SearchChip.Shorts, label: t('Shorts', 'Shorts') },
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

/** Page size for the "See more" pagination. */
export const SEARCH_PAGE_SIZE = 50;

export function searchUrl(query: string, chip: SearchChip): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}${CHIP_SP[chip]}`;
}

/** Refines a raw page client-side per chip (see CHIP_SP note). */
export function filterByChip<T extends { url: string; duration?: number; is_playlist: boolean }>(
  page: T[],
  chip: SearchChip,
): T[] {
  // All chips drop channels/playlists (YoutubeTab entries): only single videos
  // are downloadable here.
  const vids = page.filter((v) => !v.is_playlist);
  if (chip === SearchChip.Shorts) {
    return vids.filter((v) => v.url.includes('/shorts/') || (v.duration != null && v.duration <= SHORTS_MAX_SECONDS));
  }
  return vids;
}
