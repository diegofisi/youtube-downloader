import { FolderIcon } from 'lucide-react';
import { Stack } from '@/shared/components/layout/Stack';
import { Button } from '@/shared/components/ui/button';
import { ChipGroup } from '@/shared/components/ui/ChipGroup';
import { Input } from '@/shared/components/ui/input';
import { SegmentedControl } from '@/shared/components/ui/SegmentedControl';
import { Small } from '@/shared/components/ui/typography';
import { Switch } from '@/shared/components/ui/switch';
import { t } from '@/shared/lib/i18n';
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
  <SettingsSection title={t('Descarga por defecto', 'Download defaults')}>
    <SettingsRow
      title={t('Modo por defecto', 'Default mode')}
      description={t('Qué se descarga si no eliges otra cosa', "What gets downloaded if you don't choose otherwise")}
    >
      <SegmentedControl
        options={[
          { value: DownloadMode.Video, label: t('Video + audio', 'Video + audio') },
          { value: DownloadMode.Audio, label: t('Solo audio', 'Audio only') },
        ]}
        value={values.defaultMode}
        onChange={(v) => onField('defaultMode', v)}
      />
    </SettingsRow>
    <SettingsRow title={t('Calidad', 'Quality')}>
      <ChipGroup
        options={[
          { value: 'auto', label: 'Auto' },
          { value: 'max', label: t('Máx', 'Max') },
          { value: '2160', label: '4K' },
          { value: '1080', label: '1080p' },
          { value: '720', label: '720p' },
          { value: '480', label: '480p' },
        ]}
        value={values.defaultQuality}
        onChange={(v) => onField('defaultQuality', v)}
      />
    </SettingsRow>
    <SettingsRow title={t('Formato', 'Format')}>
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
      title={t('Plantilla de nombre', 'Filename template')}
      description={t('Cómo se nombran los archivos (%(title)s, %(id)s…)', 'How files are named (%(title)s, %(id)s…)')}
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
        {templateError !== undefined && <Small className="font-normal text-destructive">{templateError}</Small>}
      </Stack>
    </SettingsRow>
    <SettingsRow
      title={t('Descargar subtítulos', 'Download subtitles')}
      description={t('Incluye los subtítulos si están disponibles', 'Include subtitles when available')}
    >
      <Switch checked={values.defaultSubtitles} onCheckedChange={(v) => onField('defaultSubtitles', v)} />
    </SettingsRow>
    <SettingsRow
      title={t('Guardar miniatura del video', 'Save video thumbnail')}
      description={t('Guarda la portada junto al archivo', 'Saves the cover image next to the file')}
    >
      <Switch checked={values.defaultThumbnail} onCheckedChange={(v) => onField('defaultThumbnail', v)} />
    </SettingsRow>
    <SettingsRow
      title={t('Carpeta de descargas', 'Downloads folder')}
      description={
        <Small className="block max-w-105 truncate font-mono text-xs font-normal" title={folder}>
          {folder ?? '…'}
        </Small>
      }
    >
      <Button variant="outline" size="sm" className="h-8.5" disabled={isChangingFolder} onClick={onChangeFolder}>
        <FolderIcon />
        {t('Cambiar', 'Change')}
      </Button>
    </SettingsRow>
  </SettingsSection>
);
