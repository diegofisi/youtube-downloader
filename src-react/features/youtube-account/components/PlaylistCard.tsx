import { ListVideoIcon } from 'lucide-react';
import { Box } from '@/shared/components/layout/Box';
import { Stack } from '@/shared/components/layout/Stack';
import { Span } from '@/shared/components/ui/typography';
import { t } from '@/shared/lib/i18n';
import type { FeedVideo } from '../models/feed-video.model';

const PLAYLIST_GRAD = 'linear-gradient(135deg,#2d3a6b,#7a45c2)';

interface PlaylistCardProps {
  item: FeedVideo;
  onOpen: (item: FeedVideo) => void;
}

/** Playlist card ("Playlists" tab): own styling, opens the playlist on click. */
export const PlaylistCard = ({ item, onOpen }: PlaylistCardProps) => {
  const badgeLabel =
    item.playlistCount != null ? `${item.playlistCount} ${t('videos', 'videos')}` : t('Playlist', 'Playlist');

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className="cursor-pointer overflow-hidden rounded-[13px] border border-border bg-panel text-left"
    >
      <Box className="relative aspect-video" style={{ background: PLAYLIST_GRAD }}>
        {item.thumbnail ? (
          <img src={item.thumbnail} loading="lazy" alt="" className="size-full object-cover" />
        ) : (
          <Box className="absolute inset-0 flex items-center justify-center text-white opacity-85">
            <ListVideoIcon className="size-5" />
          </Box>
        )}
        <Box className="absolute inset-0 bg-[linear-gradient(180deg,transparent_55%,rgba(0,0,0,.5))]" />
        <Span className="absolute right-2 bottom-2 flex items-center gap-[5px] rounded-[5px] bg-black/80 px-[7px] py-0.5 text-[10.5px] font-semibold text-white">
          <ListVideoIcon className="size-3" />
          {badgeLabel}
        </Span>
      </Box>
      <Stack gap="none" className="px-[11px] pt-2.5 pb-3">
        <Span className="line-clamp-2 min-h-8.5 text-[12.5px] leading-[1.35] font-semibold text-foreground">
          {item.title}
        </Span>
        <Span className="mt-[5px] truncate text-[11.5px] text-muted-foreground">
          {item.channel || t('Abrir playlist →', 'Open playlist →')}
        </Span>
      </Stack>
    </button>
  );
};
