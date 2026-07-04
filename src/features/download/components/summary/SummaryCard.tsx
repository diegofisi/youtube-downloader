import { DownloadIcon } from 'lucide-react';
import { Box } from '@/shared/components/layout/Box';
import { Stack } from '@/shared/components/layout/Stack';
import { Small, Span } from '@/shared/components/ui/typography';
import { Button } from '@/shared/components/ui/button';
import { t } from '@/shared/lib/i18n';
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

/** Action bar: selection counters, global options summary, size estimate, Download N. */
export const SummaryCard = ({ chosenCount, customCount, estMb, opts, onDownload }: SummaryCardProps) => {
  const selLabel = t(
    `${chosenCount} seleccionados${customCount > 0 ? ` · ${customCount} personalizado${customCount === 1 ? '' : 's'}` : ''}`,
    `${chosenCount} selected${customCount > 0 ? ` · ${customCount} customized` : ''}`,
  );
  const optsLabel =
    opts.mode === 'audio'
      ? `${opts.audioFmt} · ${opts.bitrate} kbps`
      : `${qualityLabel(opts.quality)} · ${opts.container}${opts.mode === 'video' ? t(' · sin audio', ' · no audio') : ''}${opts.subs ? ' · Subs' : ''}`;

  return (
    <Box className="rounded-2xl border border-border bg-panel p-[14px] shadow-stash">
      <Stack direction="row" justify="between" className="mb-1 items-baseline">
        <Small className="text-xs font-normal text-muted-foreground">{selLabel}</Small>
        <Small className="text-[11.5px] font-normal text-faint">{optsLabel}</Small>
      </Stack>
      <Stack direction="row" justify="between" className="mb-[11px] items-baseline">
        <Small className="text-xs font-normal text-muted-foreground">{t('Tamaño estimado', 'Estimated size')}</Small>
        <Span className="font-mono text-[15px] font-bold text-foreground">{estMb ? fmtSize(estMb) : '—'}</Span>
      </Stack>
      <Button onClick={onDownload} className="h-11 w-full rounded-[11px] text-sm font-bold">
        <DownloadIcon className="size-[18px]" />
        {`${t('Descargar', 'Download')} ${chosenCount || ''}`.trim()}
      </Button>
    </Box>
  );
};
