import { Stack } from '@/shared/components/layout/Stack';
import { Text } from '@/shared/components/ui/typography';
import { Input } from '@/shared/components/ui/input';
import { Switch } from '@/shared/components/ui/switch';
import { t } from '@/shared/lib/messages/t';
import type { DownloadOpts } from '../../models/download-opts.model';

interface VideoOptsAdvancedProps {
  eff: DownloadOpts;
  onSetKey: <K extends keyof DownloadOpts>(key: K, value: DownloadOpts[K]) => void;
}

export const VideoOptsAdvanced = ({ eff, onSetKey }: VideoOptsAdvancedProps) => (
  <Stack gap="md" className="gap-3.25 pt-3">
    <Stack direction="row" gap="sm" align="center" className="gap-2.5">
      <Switch checked={eff.subs} onCheckedChange={(v) => onSetKey('subs', v)} />
      <Text variant="body-sm" className=" text-foreground">{t.common.downloadSubtitles()}</Text>
      <Text variant="caption" className="ml-auto font-mono text-faint">ES</Text>
    </Stack>
    <Stack direction="row" gap="sm" align="center" className="gap-2.5">
      <Switch checked={eff.thumb} onCheckedChange={(v) => onSetKey('thumb', v)} />
      <Text variant="body-sm" className=" text-foreground">{t.download.saveThumbnail()}</Text>
    </Stack>
    <Stack gap="xs">
      <Text variant="caption" className=" font-semibold text-muted-foreground">
        {t.common.nameTemplate()}
      </Text>
      <Input
        value={eff.template}
        spellCheck={false}
        onChange={(e) => onSetKey('template', e.target.value)}
        className="h-8.5 font-mono text-xs"
      />
    </Stack>
  </Stack>
);
