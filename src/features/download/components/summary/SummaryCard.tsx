import { DownloadIcon } from 'lucide-react';
import { Box } from '@/shared/components/layout/Box';
import { Stack } from '@/shared/components/layout/Stack';
import { Text } from '@/shared/components/ui/typography';
import { Button } from '@/shared/components/ui/button';
import { t } from '@/shared/lib/messages/t';
import type { DownloadOpts } from '../../models/download-opts.model';
import { fmtSize } from '../../helpers/format';
import { qualityLabel } from '../../helpers/opts';

interface SummaryCardProps {
  chosenCount: number;
  customCount: number;
  estMb: number;
  opts: DownloadOpts;
  onDownload: () => void;
}

export const SummaryCard = ({ chosenCount, customCount, estMb, opts, onDownload }: SummaryCardProps) => {
  const selLabel = t.download.selectionSummary({ chosen: chosenCount, custom: customCount });
  const optsLabel =
    opts.mode === 'audio'
      ? `${opts.audioFmt} · ${opts.bitrate} kbps`
      : `${qualityLabel(opts.quality)} · ${opts.container}${opts.mode === 'video' ? t.download.noAudioSuffix() : ''}${opts.subs ? ' · Subs' : ''}`;

  return (
    <Box className="rounded-2xl border border-border bg-panel p-3.5 shadow-stash">
      <Stack direction="row" justify="between" className="mb-1 items-baseline">
        <Text variant="small" className="text-xs font-normal text-muted-foreground">{selLabel}</Text>
        <Text variant="caption" className=" font-normal text-faint">{optsLabel}</Text>
      </Stack>
      <Stack direction="row" justify="between" className="mb-2.75 items-baseline">
        <Text variant="small" className="text-xs font-normal text-muted-foreground">{t.download.estimatedSize()}</Text>
        <Text variant="inline" className="font-mono text-body font-bold text-foreground">{estMb ? fmtSize(estMb) : '—'}</Text>
      </Stack>
      <Button onClick={onDownload} className="h-11 w-full rounded-[11px] text-sm font-bold">
        <DownloadIcon className="size-4.5" />
        {`${t.common.download()} ${chosenCount || ''}`.trim()}
      </Button>
    </Box>
  );
};
