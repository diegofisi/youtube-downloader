import { z } from 'zod/v4';
import { t } from '@/shared/lib/i18n';
import { Container, DownloadMode, type Settings } from '../models/settings.model';

// Builder (not a const): the template message must follow the live language (see forms reference).
export const buildSettingsSchema = () =>
  z.object({
    defaultQuality: z.string().min(1),
    defaultContainer: z.enum([Container.Mp4, Container.Mkv, Container.Webm]),
    defaultAudioFormat: z.string().min(1),
    defaultConcurrency: z.number().int().min(0),
    defaultMode: z.enum([DownloadMode.Video, DownloadMode.Audio]),
    defaultTemplate: z.string().min(1, t('La plantilla no puede estar vacía', 'Template cannot be empty')),
    defaultSubtitles: z.boolean(),
    defaultThumbnail: z.boolean(),
    clearLinksAfterPreview: z.boolean(),
  });

export type SettingsForm = z.infer<ReturnType<typeof buildSettingsSchema>>;

/** Model → form values (the folder is not a form field — it has its own picker flow). */
export const toFormValues = (s: Settings): SettingsForm => ({
  defaultQuality: s.defaultQuality,
  defaultContainer: s.defaultContainer,
  defaultAudioFormat: s.defaultAudioFormat,
  defaultConcurrency: s.defaultConcurrency,
  defaultMode: s.defaultMode,
  defaultTemplate: s.defaultTemplate,
  defaultSubtitles: s.defaultSubtitles,
  defaultThumbnail: s.defaultThumbnail,
  clearLinksAfterPreview: s.clearLinksAfterPreview,
});
