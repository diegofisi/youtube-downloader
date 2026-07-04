import { toast } from 'sonner';
import { Stack } from '@/shared/components/layout/Stack';
import { PageError } from '@/shared/components/ui/PageError';
import { PageLoading } from '@/shared/components/ui/PageLoading';
import { H1, P } from '@/shared/components/ui/typography';
import { t } from '@/shared/lib/i18n';
import { useUiStore } from '@/shared/stores/useUiStore';
import { useGetDownloadFolder } from '../api/get-download-folder/useGetDownloadFolder';
import { useSetDownloadFolder } from '../api/set-download-folder/useSetDownloadFolder';
import { useSettingsAutosave } from '../hooks/useSettingsAutosave';
import { useTroubleshooting } from '../hooks/useTroubleshooting';
import { AppearanceSection } from '../components/AppearanceSection';
import { BehaviorSection } from '../components/BehaviorSection';
import { DefaultsSection } from '../components/DefaultsSection';
import { TroubleshootingSection } from '../components/TroubleshootingSection';

// Pattern C (page + custom hooks): one route, several independent operations but no
// dialog orchestration — the heavy logic lives in useSettingsAutosave/useTroubleshooting.
export const AjustesPage = () => {
  const lang = useUiStore((s) => s.lang);
  const setLang = useUiStore((s) => s.setLang);
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);

  const settings = useSettingsAutosave();
  const troubleshooting = useTroubleshooting();
  const { data: folder } = useGetDownloadFolder();
  const { mutate: changeFolder, isPending: isChangingFolder } = useSetDownloadFolder();

  const onChangeFolder = () => {
    changeFolder(undefined, {
      onError: (e) =>
        toast.error(t('No se pudo cambiar la carpeta', 'Could not change the folder'), {
          description: String(e),
        }),
    });
  };

  return (
    <Stack gap="lg" className="mx-auto w-full max-w-[780px] px-[30px] pt-[26px] pb-16">
      <Stack gap="xs">
        <H1>{t('Ajustes', 'Settings')}</H1>
        <P color="muted" className="text-[13.5px]">
          {t(
            'La calidad y el formato los eliges al momento de descargar. Aquí va lo demás.',
            'You pick quality and format when downloading. Everything else lives here.',
          )}
        </P>
      </Stack>
      {settings.isLoading && <PageLoading message={t('Cargando ajustes...', 'Loading settings...')} />}
      {settings.isError && (
        <PageError message={t('No se pudieron cargar los ajustes.', 'Failed to load the settings.')} />
      )}
      {settings.ready && (
        <Stack gap="md">
          <AppearanceSection
            lang={lang}
            theme={theme}
            concurrency={settings.values.defaultConcurrency}
            onLangChange={setLang}
            onThemeChange={setTheme}
            onConcurrencyChange={(v) => settings.setField('defaultConcurrency', v)}
          />
          <DefaultsSection
            values={settings.values}
            templateError={settings.templateError}
            folder={folder}
            isChangingFolder={isChangingFolder}
            onField={settings.setField}
            onTemplateChange={settings.onTemplateChange}
            onTemplateBlur={settings.onTemplateBlur}
            onChangeFolder={onChangeFolder}
          />
          <BehaviorSection
            clearLinksAfterPreview={settings.values.clearLinksAfterPreview}
            onChange={(v) => settings.setField('clearLinksAfterPreview', v)}
          />
          <TroubleshootingSection
            status={troubleshooting.status}
            repairing={troubleshooting.repairing}
            progress={troubleshooting.progress}
            error={troubleshooting.error}
            onRepair={troubleshooting.onRepair}
          />
        </Stack>
      )}
    </Stack>
  );
};
