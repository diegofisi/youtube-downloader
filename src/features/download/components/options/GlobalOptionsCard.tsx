import { FolderIcon } from 'lucide-react';
import { Box } from '@/shared/components/layout/Box';
import { Stack } from '@/shared/components/layout/Stack';
import { Text } from '@/shared/components/ui/typography';
import { ChipGroup } from '@/shared/components/ui/ChipGroup';
import { t } from '@/shared/lib/messages/t';
import type { DownloadOpts } from '../../models/download-opts.model';
import { audioFmtChips, bitrateChips, containerChips, qualityChips } from '../../helpers/opts';
import { ModeCards } from './ModeCards';

interface GlobalOptionsCardProps {
  opts: DownloadOpts;
  folder?: string;
  onOptsChange: (patch: Partial<DownloadOpts>) => void;
  onOpenAjustes: () => void;
}

export const GlobalOptionsCard = ({ opts, folder, onOptsChange, onOpenAjustes }: GlobalOptionsCardProps) => (
  <Box className="rounded-2xl border border-border bg-panel p-4 shadow-stash">
    <Text variant="inline" className="block font-display text-sm font-bold">{t.download.optionsTitle()}</Text>
    <Text variant="caption" className="mt-0.75 mb-3.5 block font-normal text-muted-foreground">
      {t.download.optionsSubtitle()}
    </Text>

    <ModeCards mode={opts.mode} onChange={(mode) => onOptsChange({ mode })} />

    {opts.mode !== 'audio' && (
      <Stack gap="md" className="mt-3.5 gap-3.5 border-t border-border pt-3.5">
        <Stack gap="xs">
          <Text variant="caption" className=" font-semibold text-muted-foreground">{t.common.quality()}</Text>
          <ChipGroup options={qualityChips()} value={opts.quality} onChange={(quality) => onOptsChange({ quality })} />
        </Stack>
        <Stack gap="xs">
          <Text variant="caption" className=" font-semibold text-muted-foreground">
            {t.download.fileFormat()}
          </Text>
          <ChipGroup
            options={containerChips()}
            value={opts.container}
            onChange={(container) => onOptsChange({ container })}
          />
        </Stack>
      </Stack>
    )}

    {opts.mode === 'audio' && (
      <Stack gap="md" className="mt-3.5 gap-3.5 border-t border-border pt-3.5">
        <Stack gap="xs">
          <Text variant="caption" className=" font-semibold text-muted-foreground">
            {t.download.audioFormat()}
          </Text>
          <ChipGroup
            options={audioFmtChips()}
            value={opts.audioFmt}
            onChange={(audioFmt) => onOptsChange({ audioFmt })}
          />
        </Stack>
        <Stack gap="xs">
          <Text variant="caption" className=" font-semibold text-muted-foreground">
            {t.download.audioQuality()}
          </Text>
          <ChipGroup options={bitrateChips()} value={opts.bitrate} onChange={(bitrate) => onOptsChange({ bitrate })} />
        </Stack>
      </Stack>
    )}

    {/* Destination folder: informational only; changed from Settings. */}
    <Stack direction="row" gap="sm" align="center" className="mt-3.5 border-t border-border pt-3.25">
      <FolderIcon className="size-3.5 flex-none text-faint" />
      <Text variant="caption"
        title={t.download.currentFolder()}
        className="min-w-0 flex-1 truncate font-mono text-faint"
      >
        {folder ?? '…'}
      </Text>
      <button
        type="button"
        onClick={onOpenAjustes}
        className="flex-none rounded-md px-1 py-0.5 text-caption font-semibold text-primary transition-colors hover:bg-primary-soft"
      >
        {t.download.changeInSettings()}
      </button>
    </Stack>
  </Box>
);
