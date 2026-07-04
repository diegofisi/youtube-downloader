import { toast } from 'sonner';
import { Stack } from '@/shared/components/layout/Stack';
import { PageError } from '@/shared/components/ui/PageError';
import { PageLoading } from '@/shared/components/ui/PageLoading';
import { Text } from '@/shared/components/ui/typography';
import { t } from '@/shared/lib/messages/t';
import { useUiStore } from '@/shared/stores/useUiStore';
import { useGetDownloadFolder } from '../api/get-download-folder/useGetDownloadFolder';
import { useSetDownloadFolder } from '../api/set-download-folder/useSetDownloadFolder';
import { useSettingsAutosave } from '../hooks/useSettingsAutosave';
import { useTroubleshooting } from '../hooks/useTroubleshooting';
import { AppearanceSection } from '../components/AppearanceSection';
import { BehaviorSection } from '../components/BehaviorSection';
import { DefaultsSection } from '../components/DefaultsSection';
import { TroubleshootingSection } from '../components/TroubleshootingSection';

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
        toast.error(t.settings.folderChangeError(), {
          description: String(e),
        }),
    });
  };

  return (
    <Stack gap="lg" className="mx-auto w-full max-w-195 px-7.5 pt-6.5 pb-16">
      <Stack gap="xs">
        <Text variant="h1">{t.common.settings()}</Text>
        <Text variant="body-sm" color="muted">
          {t.settings.pageSubtitle()}
        </Text>
      </Stack>
      {settings.isLoading && <PageLoading message={t.settings.loading()} />}
      {settings.isError && (
        <PageError message={t.settings.loadError()} />
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
