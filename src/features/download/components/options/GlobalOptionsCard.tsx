import { FolderIcon } from 'lucide-react';
import { Box } from '@/shared/components/layout/Box';
import { Stack } from '@/shared/components/layout/Stack';
import { Small, Span } from '@/shared/components/ui/typography';
import { ChipGroup } from '@/shared/components/ui/ChipGroup';
import { t } from '@/shared/lib/i18n';
import type { DownloadOpts } from '../../models/download-opts.model';
import { audioFmtChips, bitrateChips, containerChips, qualityChips } from '../../helpers/opts';
import { ModeCards } from './ModeCards';

interface GlobalOptionsCardProps {
  opts: DownloadOpts;
  folder?: string;
  onOptsChange: (patch: Partial<DownloadOpts>) => void;
  onOpenAjustes: () => void;
}

/** Global options panel: mode cards + quality/container or audio chips + folder row. */
export const GlobalOptionsCard = ({ opts, folder, onOptsChange, onOpenAjustes }: GlobalOptionsCardProps) => (
  <Box className="rounded-2xl border border-border bg-panel p-4 shadow-stash">
    <Span className="block font-display text-sm font-bold">{t('Opciones de descarga', 'Download options')}</Span>
    <Small className="mt-0.75 mb-3.5 block text-[11.5px] font-normal text-muted-foreground">
      {t(
        'Por defecto: video + audio en MP4, mejor calidad disponible.',
        'Default: video + audio in MP4, best available quality.',
      )}
    </Small>

    <ModeCards mode={opts.mode} onChange={(mode) => onOptsChange({ mode })} />

    {opts.mode !== 'audio' && (
      <Stack gap="md" className="mt-3.5 gap-3.5 border-t border-border pt-3.5">
        <Stack gap="xs">
          <Small className="text-[11.5px] font-semibold text-muted-foreground">{t('Calidad', 'Quality')}</Small>
          <ChipGroup options={qualityChips()} value={opts.quality} onChange={(quality) => onOptsChange({ quality })} />
        </Stack>
        <Stack gap="xs">
          <Small className="text-[11.5px] font-semibold text-muted-foreground">
            {t('Formato del archivo', 'File format')}
          </Small>
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
          <Small className="text-[11.5px] font-semibold text-muted-foreground">
            {t('Formato de audio', 'Audio format')}
          </Small>
          <ChipGroup
            options={audioFmtChips()}
            value={opts.audioFmt}
            onChange={(audioFmt) => onOptsChange({ audioFmt })}
          />
        </Stack>
        <Stack gap="xs">
          <Small className="text-[11.5px] font-semibold text-muted-foreground">
            {t('Calidad de audio', 'Audio quality')}
          </Small>
          <ChipGroup options={bitrateChips()} value={opts.bitrate} onChange={(bitrate) => onOptsChange({ bitrate })} />
        </Stack>
      </Stack>
    )}

    {/* Destination folder: informational only; changed from Settings. */}
    <Stack direction="row" gap="sm" align="center" className="mt-3.5 border-t border-border pt-3.25">
      <FolderIcon className="size-3.5 flex-none text-faint" />
      <Span
        title={t('Carpeta de descargas actual', 'Current downloads folder')}
        className="min-w-0 flex-1 truncate font-mono text-[11px] text-faint"
      >
        {folder ?? '…'}
      </Span>
      <button
        type="button"
        onClick={onOpenAjustes}
        className="flex-none rounded-md px-1 py-0.5 text-[11px] font-semibold text-primary transition-colors hover:bg-primary-soft"
      >
        {t('Cambiar en Ajustes', 'Change in Settings')}
      </button>
    </Stack>
  </Box>
);
