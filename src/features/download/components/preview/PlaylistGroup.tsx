import { ChevronDownIcon, ChevronRightIcon, PlayIcon } from 'lucide-react';
import { Box } from '@/shared/components/layout/Box';
import { Stack } from '@/shared/components/layout/Stack';
import { Span } from '@/shared/components/ui/typography';
import { t } from '@/shared/lib/i18n';
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

/** Collapsible playlist group: select-all header + compact child rows. */
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
      <Stack direction="row" gap="sm" align="center" className="gap-3 px-[13px] py-3">
        <SelectToggle on={item.allSelected} disabled={item.nSelectable === 0} onToggle={onToggleGroup} />
        <Box className="relative size-12 w-14 flex-none">
          <Box
            className="absolute top-0 right-[6px] left-[6px] h-[6px] rounded-t opacity-45"
            style={{ background: gradFor(p.id) }}
          />
          <Box
            className="absolute top-1 right-[2px] bottom-0 left-[2px] flex items-center justify-center overflow-hidden rounded-lg text-white opacity-90"
            style={{ background: gradFor(p.id) }}
          >
            <PlayIcon className="size-5 fill-current" />
          </Box>
          <Span className="absolute right-[3px] bottom-[3px] rounded bg-black/80 px-[5px] py-px font-mono text-[9.5px] font-bold text-white">
            {p.count}
          </Span>
        </Box>
        <Stack gap="xs" className="min-w-0 flex-1">
          <Stack direction="row" gap="sm" align="center" className="min-w-0">
            <Span className="flex-none rounded-[5px] bg-primary-soft px-[7px] py-[2px] text-[9.5px] font-bold tracking-[.5px] text-primary">
              PLAYLIST
            </Span>
            <Span className="truncate text-[13.5px] font-semibold text-foreground">{p.title}</Span>
          </Stack>
          <Span className="block truncate text-xs text-muted-foreground">
            {p.channel} ·{' '}
            {t(
              `${p.count} videos · ${item.nSel} de ${item.nSelectable} elegidos`,
              `${p.count} videos · ${item.nSel} of ${item.nSelectable} selected`,
            )}
          </Span>
        </Stack>
        <button
          type="button"
          onClick={onToggleExpanded}
          className={cn(
            'flex h-[30px] flex-none items-center gap-[5px] rounded-lg px-[11px] text-xs font-semibold',
            'text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
          )}
        >
          {item.expanded ? t('Ocultar', 'Hide') : t('Ver', 'View')}
          {item.expanded ? <ChevronDownIcon className="size-[15px]" /> : <ChevronRightIcon className="size-[15px]" />}
        </button>
      </Stack>
      {item.expanded && (
        <Stack gap="xs" className="gap-[6px] border-t border-border p-[9px]">
          {item.children.map((vm, i) => (
            <PlaylistChildRow key={`${i}:${vm.video.url}`} vm={vm} onToggle={onToggleVideo} onOpenOpts={onOpenOpts} />
          ))}
        </Stack>
      )}
    </Box>
  );
};
