import { CheckIcon, PlayIcon } from 'lucide-react';
import { Box } from '@/shared/components/layout/Box';
import { Stack } from '@/shared/components/layout/Stack';
import { Text } from '@/shared/components/ui/typography';
import { cn } from '@/shared/lib/utils';
import { DownloadMenu } from './DownloadMenu';
import { CARD_GRAD, formatDuration, type MediaItem } from './media-item';

interface MediaCardProps {
  item: MediaItem;
  selected: boolean;
  onToggleSelect: (item: MediaItem) => void;
  onDownload: (item: MediaItem) => void;
  onCustomize: (item: MediaItem) => void;
}

export const MediaCard = ({ item, selected, onToggleSelect, onDownload, onCustomize }: MediaCardProps) => (
  <Box className={cn('rounded-[13px] border bg-panel', selected ? 'border-primary' : 'border-border')}>
    <Box className="relative">
      <Box className="aspect-video overflow-hidden rounded-t-xl" style={{ background: CARD_GRAD }}>
        {item.thumbnail ? (
          <img src={item.thumbnail} loading="lazy" alt="" className="size-full object-cover" />
        ) : (
          <Box className="flex size-full items-center justify-center text-white opacity-85">
            <PlayIcon className="size-5" />
          </Box>
        )}
      </Box>
      <button
        type="button"
        onClick={() => onToggleSelect(item)}
        className={cn(
          'absolute top-2 left-2 flex size-6 items-center justify-center rounded-[7px] border-[1.8px] text-white backdrop-blur-sm',
          selected ? 'border-primary bg-primary' : 'border-white/70 bg-black/40',
        )}
      >
        {selected && <CheckIcon className="size-3.5" />}
      </button>
      <DownloadMenu
        className="absolute top-2 right-2"
        onDownload={() => onDownload(item)}
        onCustomize={() => onCustomize(item)}
      />
      {item.duration ? (
        <Text variant="micro" className="absolute right-2 bottom-2 rounded-[5px] bg-black/80 px-1.25 py-px font-mono font-semibold text-white">
          {formatDuration(item.duration)}
        </Text>
      ) : null}
    </Box>
    <Stack gap="none" className="px-2.75 pt-2.5 pb-3">
      <Text variant="small" className="line-clamp-2 min-h-8.5 leading-[1.35] font-semibold text-foreground">
        {item.title}
      </Text>
      <Text variant="caption" className="mt-1.25 truncate text-muted-foreground">{item.channel}</Text>
    </Stack>
  </Box>
);
