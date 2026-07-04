import { ListVideoIcon } from 'lucide-react';
import { Box } from '@/shared/components/layout/Box';
import { Stack } from '@/shared/components/layout/Stack';
import { Text } from '@/shared/components/ui/typography';
import { t } from '@/shared/lib/messages/t';
import type { FeedVideo } from '../models/feed-video.model';

const PLAYLIST_GRAD = 'linear-gradient(135deg,#2d3a6b,#7a45c2)';

interface PlaylistCardProps {
  item: FeedVideo;
  onOpen: (item: FeedVideo) => void;
}

export const PlaylistCard = ({ item, onOpen }: PlaylistCardProps) => {
  const badgeLabel =
    item.playlistCount != null ? `${item.playlistCount} ${t.youtube.videosNoun()}` : t.youtube.playlist();

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
        <Text variant="micro" className="absolute right-2 bottom-2 flex items-center gap-1.25 rounded-[5px] bg-black/80 px-1.75 py-0.5 font-semibold text-white">
          <ListVideoIcon className="size-3" />
          {badgeLabel}
        </Text>
      </Box>
      <Stack gap="none" className="px-2.75 pt-2.5 pb-3">
        <Text variant="small" className="line-clamp-2 min-h-8.5 leading-[1.35] font-semibold text-foreground">
          {item.title}
        </Text>
        <Text variant="caption" className="mt-1.25 truncate text-muted-foreground">
          {item.channel || t.youtube.openPlaylist()}
        </Text>
      </Stack>
    </button>
  );
};
