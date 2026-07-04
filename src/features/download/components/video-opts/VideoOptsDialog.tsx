import { useState } from 'react';
import { ChevronRightIcon, SettingsIcon } from 'lucide-react';
import { Box } from '@/shared/components/layout/Box';
import { Stack } from '@/shared/components/layout/Stack';
import { Text } from '@/shared/components/ui/typography';
import { Button } from '@/shared/components/ui/button';
import { ChipGroup } from '@/shared/components/ui/ChipGroup';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/components/ui/dialog';
import { t } from '@/shared/lib/messages/t';
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
      <DialogContent className="max-w-96 gap-0 p-0">
        <Stack
          direction="row"
          gap="sm"
          align="center"
          className="gap-2.5 border-b border-border px-4.25 py-3.75"
        >
          <SettingsIcon className="size-4.25 flex-none text-primary" />
          <DialogTitle className="text-body-sm">{t.download.videoOptions()}</DialogTitle>
        </Stack>

        <Stack gap="md" className="max-h-[60vh] overflow-y-auto px-4.25 py-3.75">
          <DialogDescription className="truncate rounded-[9px] bg-background px-2.75 py-2.25 text-small text-muted-foreground">
            {video.title}
          </DialogDescription>

          <Stack gap="xs">
            <Text variant="caption" className=" font-semibold text-muted-foreground">
              {t.download.whatToDownload()}
            </Text>
            <ChipGroup options={modeChips()} value={eff.mode} onChange={(mode) => setKey('mode', mode)} />
          </Stack>

          {eff.mode !== 'audio' && (
            <>
              <Stack gap="xs">
                <Text variant="caption" className=" font-semibold text-muted-foreground">{t.common.quality()}</Text>
                <ChipGroup
                  options={qualityChips()}
                  value={eff.quality}
                  onChange={(quality) => setKey('quality', quality)}
                />
              </Stack>
              <Stack gap="xs">
                <Text variant="caption" className=" font-semibold text-muted-foreground">
                  {t.download.fileFormat()}
                </Text>
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
                <Text variant="caption" className=" font-semibold text-muted-foreground">
                  {t.download.audioFormat()}
                </Text>
                <ChipGroup
                  options={audioFmtChips()}
                  value={eff.audioFmt}
                  onChange={(audioFmt) => setKey('audioFmt', audioFmt)}
                />
              </Stack>
              <Stack gap="xs">
                <Text variant="caption" className=" font-semibold text-muted-foreground">
                  {t.download.audioQuality()}
                </Text>
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
              className="flex w-full items-center gap-1.75 rounded-lg px-0.5 py-1 text-left text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              <ChevronRightIcon className={cn('size-3.25 flex-none transition-transform', advOpen && 'rotate-90')} />
              {t.download.advanced()}
            </button>
            {advOpen && <VideoOptsAdvanced eff={eff} onSetKey={setKey} />}
          </Box>
        </Stack>

        <Stack direction="row" gap="sm" className="gap-2.5 border-t border-border px-4.25 py-3.5">
          {Object.keys(draft).length > 0 && (
            <Button variant="outline" onClick={onClear} className="h-10 px-3.5 text-small">
              {t.download.useGlobal()}
            </Button>
          )}
          <Box className="flex-1" />
          <Button onClick={() => onCommit(draft)} className="h-10 px-5.5 text-body-sm font-bold">
            {t.common.ready()}
          </Button>
        </Stack>
      </DialogContent>
    </Dialog>
  );
};
