import { ChevronDownIcon, ChevronRightIcon, PlayIcon } from 'lucide-react';
import { Box } from '@/shared/components/layout/Box';
import { Stack } from '@/shared/components/layout/Stack';
import { Text } from '@/shared/components/ui/typography';
import { t } from '@/shared/lib/messages/t';
import { cn } from '@/shared/lib/utils';
import { gradFor } from '../../helpers/format';
import type { PreviewItemVM } from '../../hooks/usePreviewDerived';
import { PlaylistChildRow } from './PlaylistChildRow';
import { SelectToggle } from './SelectToggle';

interface PlaylistGroupProps {
  item: Extract<PreviewItemVM, { kind: 'playlist' }>;
  onToggleGroup: () => void;
  onToggleExpanded: () => void;
  onToggleVideo: (url: string) => void;
  onOpenOpts: (url: string) => void;
}

export const PlaylistGroup = ({
  item,
  onToggleGroup,
  onToggleExpanded,
  onToggleVideo,
  onOpenOpts,
}: PlaylistGroupProps) => {
  const p = item.playlist;
  return (
    <Box className="overflow-hidden rounded-[14px] border border-border bg-panel">
      <Stack direction="row" gap="sm" align="center" className="gap-3 px-3.25 py-3">
        <SelectToggle on={item.allSelected} disabled={item.nSelectable === 0} onToggle={onToggleGroup} />
        <Box className="relative size-12 w-14 flex-none">
          <Box
            className="absolute top-0 right-1.5 left-1.5 h-1.5 rounded-t opacity-45"
            style={{ background: gradFor(p.id) }}
          />
          <Box
            className="absolute top-1 right-0.5 bottom-0 left-0.5 flex items-center justify-center overflow-hidden rounded-lg text-white opacity-90"
            style={{ background: gradFor(p.id) }}
          >
            <PlayIcon className="size-5 fill-current" />
          </Box>
          <Text variant="micro" className="absolute right-0.75 bottom-0.75 rounded bg-black/80 px-1.25 py-px font-mono font-bold text-white">
            {p.count}
          </Text>
        </Box>
        <Stack gap="xs" className="min-w-0 flex-1">
          <Stack direction="row" gap="sm" align="center" className="min-w-0">
            <Text variant="micro" className="flex-none rounded-[5px] bg-primary-soft px-1.75 py-0.5 font-bold tracking-[.5px] text-primary">
              PLAYLIST
            </Text>
            <Text variant="body-sm" className="truncate font-semibold text-foreground">{p.title}</Text>
          </Stack>
          <Text variant="inline" className="block truncate text-xs text-muted-foreground">
            {p.channel} ·{' '}
            {t.download.playlistMeta({ count: p.count, sel: item.nSel, total: item.nSelectable })}
          </Text>
        </Stack>
        <button
          type="button"
          onClick={onToggleExpanded}
          className={cn(
            'flex h-7.5 flex-none items-center gap-1.25 rounded-lg px-2.75 text-xs font-semibold',
            'text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
          )}
        >
          {item.expanded ? t.download.hide() : t.download.show()}
          {item.expanded ? <ChevronDownIcon className="size-3.75" /> : <ChevronRightIcon className="size-3.75" />}
        </button>
      </Stack>
      {item.expanded && (
        <Stack gap="xs" className="gap-1.5 border-t border-border p-2.25">
          {item.children.map((vm, i) => (
            <PlaylistChildRow key={`${i}:${vm.video.url}`} vm={vm} onToggle={onToggleVideo} onOpenOpts={onOpenOpts} />
          ))}
        </Stack>
      )}
    </Box>
  );
};
