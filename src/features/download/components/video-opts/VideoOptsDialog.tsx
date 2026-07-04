import { useState } from 'react';
import { ChevronRightIcon, SettingsIcon } from 'lucide-react';
import { Box } from '@/shared/components/layout/Box';
import { Stack } from '@/shared/components/layout/Stack';
import { Small } from '@/shared/components/ui/typography';
import { Button } from '@/shared/components/ui/button';
import { ChipGroup } from '@/shared/components/ui/ChipGroup';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/components/ui/dialog';
import { t } from '@/shared/lib/i18n';
import { cn } from '@/shared/lib/utils';
import type { AnalyzedVideo } from '../../models/analyzed.model';
import type { DownloadOpts, OptsOverride } from '../../models/download-opts.model';
import { audioFmtChips, bitrateChips, containerChips, modeChips, qualityChips } from '../../helpers/opts';
import { VideoOptsAdvanced } from './VideoOptsAdvanced';

interface VideoOptsDialogProps {
  video: AnalyzedVideo;
  globalOpts: DownloadOpts;
  initialOverride?: OptsOverride;
  /** "Listo" commits the draft; the store deletes the override when it's empty. */
  onCommit: (draft: OptsOverride) => void;
  /** "Usar generales": drop the override entirely and close. */
  onClear: () => void;
  /** X / Escape / backdrop: discard the draft. */
  onClose: () => void;
}

/** Per-video options dialog with draft semantics (remount per open via key={url}). */
export const VideoOptsDialog = ({
  video,
  globalOpts,
  initialOverride,
  onCommit,
  onClear,
  onClose,
}: VideoOptsDialogProps) => {
  const [draft, setDraft] = useState<OptsOverride>(() => ({ ...(initialOverride ?? {}) }));
  const [advOpen, setAdvOpen] = useState(false);
  const eff: DownloadOpts = { ...globalOpts, ...draft };

  const setKey = <K extends keyof DownloadOpts>(k: K, v: DownloadOpts[K]) => setDraft((d) => ({ ...d, [k]: v }));

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[384px] gap-0 p-0">
        <Stack
          direction="row"
          gap="sm"
          align="center"
          className="gap-[10px] border-b border-border px-[17px] py-[15px]"
        >
          <SettingsIcon className="size-[17px] flex-none text-primary" />
          <DialogTitle className="text-[14.5px]">{t('Opciones de este video', 'Options for this video')}</DialogTitle>
        </Stack>

        <Stack gap="md" className="max-h-[60vh] overflow-y-auto px-[17px] py-[15px]">
          <DialogDescription className="truncate rounded-[9px] bg-background px-[11px] py-[9px] text-[12.5px] text-muted-foreground">
            {video.title}
          </DialogDescription>

          <Stack gap="xs">
            <Small className="text-[11.5px] font-semibold text-muted-foreground">
              {t('Qué descargar', 'What to download')}
            </Small>
            <ChipGroup options={modeChips()} value={eff.mode} onChange={(mode) => setKey('mode', mode)} />
          </Stack>

          {eff.mode !== 'audio' && (
            <>
              <Stack gap="xs">
                <Small className="text-[11.5px] font-semibold text-muted-foreground">{t('Calidad', 'Quality')}</Small>
                <ChipGroup
                  options={qualityChips()}
                  value={eff.quality}
                  onChange={(quality) => setKey('quality', quality)}
                />
              </Stack>
              <Stack gap="xs">
                <Small className="text-[11.5px] font-semibold text-muted-foreground">
                  {t('Formato del archivo', 'File format')}
                </Small>
                <ChipGroup
                  options={containerChips()}
                  value={eff.container}
                  onChange={(container) => setKey('container', container)}
                />
              </Stack>
            </>
          )}

          {eff.mode === 'audio' && (
            <>
              <Stack gap="xs">
                <Small className="text-[11.5px] font-semibold text-muted-foreground">
                  {t('Formato de audio', 'Audio format')}
                </Small>
                <ChipGroup
                  options={audioFmtChips()}
                  value={eff.audioFmt}
                  onChange={(audioFmt) => setKey('audioFmt', audioFmt)}
                />
              </Stack>
              <Stack gap="xs">
                <Small className="text-[11.5px] font-semibold text-muted-foreground">
                  {t('Calidad de audio', 'Audio quality')}
                </Small>
                <ChipGroup
                  options={bitrateChips()}
                  value={eff.bitrate}
                  onChange={(bitrate) => setKey('bitrate', bitrate)}
                />
              </Stack>
            </>
          )}

          <Box className="border-t border-border pt-3">
            <button
              type="button"
              onClick={() => setAdvOpen((o) => !o)}
              className="flex w-full items-center gap-[7px] rounded-lg px-[2px] py-1 text-left text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              <ChevronRightIcon className={cn('size-[13px] flex-none transition-transform', advOpen && 'rotate-90')} />
              {t('Avanzado', 'Advanced')}
            </button>
            {advOpen && <VideoOptsAdvanced eff={eff} onSetKey={setKey} />}
          </Box>
        </Stack>

        <Stack direction="row" gap="sm" className="gap-[10px] border-t border-border px-[17px] py-[14px]">
          {Object.keys(draft).length > 0 && (
            <Button variant="outline" onClick={onClear} className="h-10 px-[14px] text-[12.5px]">
              {t('Usar generales', 'Use defaults')}
            </Button>
          )}
          <Box className="flex-1" />
          <Button onClick={() => onCommit(draft)} className="h-10 px-[22px] text-[13px] font-bold">
            {t('Listo', 'Done')}
          </Button>
        </Stack>
      </DialogContent>
    </Dialog>
  );
};
