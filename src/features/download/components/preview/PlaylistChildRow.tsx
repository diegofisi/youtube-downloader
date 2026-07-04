import { Box } from '@/shared/components/layout/Box';
import { Stack } from '@/shared/components/layout/Stack';
import { Small, Span } from '@/shared/components/ui/typography';
import { cn } from '@/shared/lib/utils';
import { STATUS_META } from '../../helpers/analysis';
import { fmtSize } from '../../helpers/format';
import type { VideoVM } from '../../hooks/usePreviewDerived';
import { GearButton } from './GearButton';
import { SelectToggle } from './SelectToggle';
import { StatusBadge } from './StatusBadge';
import { VideoThumb } from './VideoThumb';

interface PlaylistChildRowProps {
  vm: VideoVM;
  onToggle: (url: string) => void;
  onOpenOpts: (url: string) => void;
}

/** Compact row for a video inside an expanded playlist group. */
export const PlaylistChildRow = ({ vm, onToggle, onOpenOpts }: PlaylistChildRowProps) => {
  const meta = STATUS_META[vm.status];
  return (
    <Box
      className={cn(
        'flex items-center gap-2.75 rounded-[10px] border bg-background px-2.25 py-2',
        vm.selected ? 'border-primary' : 'border-transparent',
        !meta.downloadable && 'opacity-50',
      )}
    >
      <SelectToggle on={vm.selected} disabled={!meta.downloadable} onToggle={() => onToggle(vm.video.url)} />
      <VideoThumb video={vm.video} width={92} height={52} />
      <Stack gap="xs" className="min-w-0 flex-1">
        <Span className="block truncate text-[12.5px] font-semibold text-foreground">{vm.video.title}</Span>
        <Stack direction="row" gap="sm" align="center">
          <StatusBadge label={meta.label()} tone={meta.tone} />
          <Small className="font-mono text-[11px] text-faint">{fmtSize(vm.sizeMb)}</Small>
        </Stack>
      </Stack>
      <GearButton hasOverride={vm.hasOverride} onClick={() => onOpenOpts(vm.video.url)} />
    </Box>
  );
};
