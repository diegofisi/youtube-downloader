import { Box } from '@/shared/components/layout/Box';
import { Stack } from '@/shared/components/layout/Stack';
import { Small, Span } from '@/shared/components/ui/typography';
import { t } from '@/shared/lib/i18n';
import { cn } from '@/shared/lib/utils';
import { DUP_TONE, STATUS_META, dupLabel } from '../../helpers/analysis';
import { fmtSize } from '../../helpers/format';
import { fmtDescription } from '../../helpers/opts';
import type { VideoVM } from '../../hooks/usePreviewDerived';
import { GearButton } from './GearButton';
import { SelectToggle } from './SelectToggle';
import { StatusBadge } from './StatusBadge';
import { VideoThumb } from './VideoThumb';

interface VideoCardProps {
  vm: VideoVM;
  onToggle: (url: string) => void;
  onOpenOpts: (url: string) => void;
}

/** Top-level preview card for a single (non-playlist) video. */
export const VideoCard = ({ vm, onToggle, onOpenOpts }: VideoCardProps) => {
  const meta = STATUS_META[vm.status];
  const dup = vm.video.dup;
  return (
    <Box
      className={cn(
        'flex items-center gap-3.25 rounded-[14px] border bg-panel p-2.75 transition-colors',
        vm.selected ? 'border-primary' : 'border-border',
        !meta.downloadable && 'opacity-50',
        meta.downloadable && dup && 'opacity-[.64]',
      )}
    >
      <SelectToggle on={vm.selected} disabled={!meta.downloadable} onToggle={() => onToggle(vm.video.url)} />
      <VideoThumb video={vm.video} width={120} height={68} />
      <Stack gap="xs" className="min-w-0 flex-1">
        <Span className="truncate text-[13.5px] leading-[1.3] font-semibold text-foreground block">
          {vm.video.title}
        </Span>
        <Span className="truncate text-xs text-muted-foreground block">{vm.video.channel}</Span>
        <Stack direction="row" gap="sm" align="center" className="mt-px">
          <StatusBadge label={dup ? dupLabel() : meta.label()} tone={dup ? DUP_TONE : meta.tone} />
          <Small className="font-mono text-[11.5px] text-faint">{fmtSize(vm.sizeMb)}</Small>
          {vm.hasOverride && (
            <Span
              title={t('Opciones personalizadas de este video', 'Custom options for this video')}
              className="inline-flex items-center gap-1 rounded-md bg-primary-soft px-1.75 py-0.5 text-[10px] font-semibold text-primary"
            >
              {fmtDescription(vm.eff)}
            </Span>
          )}
        </Stack>
      </Stack>
      <Stack gap="sm" align="end" className="flex-none self-start">
        <Span
          className={cn(
            'rounded-[5px] px-1.75 py-0.75 text-[9.5px] font-bold tracking-[.5px]',
            vm.eff.mode === 'audio' ? 'bg-success/15 text-success' : 'bg-accent text-faint',
          )}
        >
          {vm.eff.mode === 'audio' ? 'AUDIO' : 'VIDEO'}
        </Span>
        <GearButton hasOverride={vm.hasOverride} onClick={() => onOpenOpts(vm.video.url)} />
      </Stack>
    </Box>
  );
};
