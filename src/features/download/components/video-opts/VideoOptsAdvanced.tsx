import { Stack } from '@/shared/components/layout/Stack';
import { Small, Span } from '@/shared/components/ui/typography';
import { Input } from '@/shared/components/ui/input';
import { Switch } from '@/shared/components/ui/switch';
import { t } from '@/shared/lib/i18n';
import type { DownloadOpts } from '../../models/download-opts.model';

interface VideoOptsAdvancedProps {
  eff: DownloadOpts;
  onSetKey: <K extends keyof DownloadOpts>(key: K, value: DownloadOpts[K]) => void;
}

/** Advanced draft fields: subtitles, thumbnail and filename template. */
export const VideoOptsAdvanced = ({ eff, onSetKey }: VideoOptsAdvancedProps) => (
  <Stack gap="md" className="gap-3.25 pt-3">
    <Stack direction="row" gap="sm" align="center" className="gap-2.5">
      <Switch checked={eff.subs} onCheckedChange={(v) => onSetKey('subs', v)} />
      <Span className="text-[13px] text-foreground">{t('Descargar subtítulos', 'Download subtitles')}</Span>
      <Span className="ml-auto font-mono text-[11.5px] text-faint">ES</Span>
    </Stack>
    <Stack direction="row" gap="sm" align="center" className="gap-2.5">
      <Switch checked={eff.thumb} onCheckedChange={(v) => onSetKey('thumb', v)} />
      <Span className="text-[13px] text-foreground">{t('Guardar miniatura', 'Save thumbnail')}</Span>
    </Stack>
    <Stack gap="xs">
      <Small className="text-[11.5px] font-semibold text-muted-foreground">
        {t('Plantilla de nombre', 'Filename template')}
      </Small>
      <Input
        value={eff.template}
        spellCheck={false}
        onChange={(e) => onSetKey('template', e.target.value)}
        className="h-8.5 font-mono text-xs"
      />
    </Stack>
  </Stack>
);
