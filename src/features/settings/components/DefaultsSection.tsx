import { FolderIcon } from 'lucide-react';
import { Stack } from '@/shared/components/layout/Stack';
import { Button } from '@/shared/components/ui/button';
import { ChipGroup } from '@/shared/components/ui/ChipGroup';
import { Input } from '@/shared/components/ui/input';
import { SegmentedControl } from '@/shared/components/ui/SegmentedControl';
import { Text } from '@/shared/components/ui/typography';
import { Switch } from '@/shared/components/ui/switch';
import { t } from '@/shared/lib/messages/t';
import { Container, DownloadMode } from '../models/settings.model';
import type { SettingsForm } from '../helpers/settings.schema';
import { SettingsSection } from './SettingsSection';
import { SettingsRow } from './SettingsRow';

interface DefaultsSectionProps {
  values: SettingsForm;
  templateError?: string;
  folder?: string;
  isChangingFolder: boolean;
  onField: <K extends keyof SettingsForm>(field: K, value: SettingsForm[K]) => void;
  onTemplateChange: (value: string) => void;
  onTemplateBlur: () => void;
  onChangeFolder: () => void;
}

export const DefaultsSection = ({
  values,
  templateError,
  folder,
  isChangingFolder,
  onField,
  onTemplateChange,
  onTemplateBlur,
  onChangeFolder,
}: DefaultsSectionProps) => (
  <SettingsSection title={t.settings.defaultDownload()}>
    <SettingsRow
      title={t.settings.defaultMode()}
      description={t.settings.defaultModeHint()}
    >
      <SegmentedControl
        options={[
          { value: DownloadMode.Video, label: t.common.videoAndAudio() },
          { value: DownloadMode.Audio, label: t.common.audioOnly() },
        ]}
        value={values.defaultMode}
        onChange={(v) => onField('defaultMode', v)}
      />
    </SettingsRow>
    <SettingsRow title={t.common.quality()}>
      <ChipGroup
        options={[
          { value: 'auto', label: 'Auto' },
          { value: 'max', label: t.settings.qualityMaxShort() },
          { value: '2160', label: '4K' },
          { value: '1080', label: '1080p' },
          { value: '720', label: '720p' },
          { value: '480', label: '480p' },
        ]}
        value={values.defaultQuality}
        onChange={(v) => onField('defaultQuality', v)}
      />
    </SettingsRow>
    <SettingsRow title={t.settings.format()}>
      <ChipGroup
        options={[
          { value: Container.Mp4, label: 'MP4' },
          { value: Container.Mkv, label: 'MKV' },
          { value: Container.Webm, label: 'WebM' },
        ]}
        value={values.defaultContainer}
        onChange={(v) => onField('defaultContainer', v)}
      />
    </SettingsRow>
    <SettingsRow
      title={t.common.nameTemplate()}
      description={t.settings.templateHint()}
    >
      <Stack gap="xs" align="end">
        <Input
          value={values.defaultTemplate}
          onChange={(e) => onTemplateChange(e.target.value)}
          onBlur={onTemplateBlur}
          spellCheck={false}
          aria-invalid={templateError !== undefined}
          className="h-8.5 w-62.5 font-mono text-xs"
        />
        {templateError !== undefined && <Text variant="small" className="font-normal text-destructive">{templateError}</Text>}
      </Stack>
    </SettingsRow>
    <SettingsRow
      title={t.common.downloadSubtitles()}
      description={t.settings.subtitlesHint()}
    >
      <Switch checked={values.defaultSubtitles} onCheckedChange={(v) => onField('defaultSubtitles', v)} />
    </SettingsRow>
    <SettingsRow
      title={t.settings.thumbnail()}
      description={t.settings.thumbnailHint()}
    >
      <Switch checked={values.defaultThumbnail} onCheckedChange={(v) => onField('defaultThumbnail', v)} />
    </SettingsRow>
    <SettingsRow
      title={t.settings.downloadFolder()}
      description={
        <Text variant="small" className="block max-w-105 truncate font-mono text-xs font-normal" title={folder}>
          {folder ?? '…'}
        </Text>
      }
    >
      <Button variant="outline" size="sm" className="h-8.5" disabled={isChangingFolder} onClick={onChangeFolder}>
        <FolderIcon />
        {t.settings.change()}
      </Button>
    </SettingsRow>
  </SettingsSection>
);
