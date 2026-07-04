import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useForm, type Path, type PathValue } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { t } from '@/shared/lib/messages/t';
import { useGetSettings } from '../api/get-settings/useGetSettings';
import { useSetSettings } from '../api/set-settings/useSetSettings';
import { buildSettingsSchema, toFormValues, type SettingsForm } from '../helpers/settings.schema';

const TEMPLATE_DEBOUNCE_MS = 600;

export function useSettingsAutosave() {
  const { data: settings, isLoading, isError } = useGetSettings();
  const { mutate: saveSettings } = useSetSettings();

  const schema = useMemo(() => buildSettingsSchema(), []);
  const form = useForm<SettingsForm>({
    resolver: zodResolver(schema),
    values: settings ? toFormValues(settings) : undefined,
  });

  const values = form.watch();
  const templateError = form.formState.errors.defaultTemplate?.message;

  const save = useCallback(() => {
    saveSettings(form.getValues(), {
      onError: () => toast.error(t.settings.saveError()),
    });
  }, [form, saveSettings]);

  const setField = useCallback(
    <K extends keyof SettingsForm>(field: K, value: SettingsForm[K]) => {
      // Flat form: keyof == Path, but RHF's conditional Path types can't prove it.
      form.setValue(field as Path<SettingsForm>, value as PathValue<SettingsForm, Path<SettingsForm>>, {
        shouldDirty: true,
      });
      save();
    },
    [form, save],
  );

  const tplTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(tplTimer.current), []);

  const saveTemplateIfValid = useCallback(async () => {
    // Empty template never reaches the backend — the error stays visible instead.
    const valid = await form.trigger('defaultTemplate');
    if (valid) save();
  }, [form, save]);

  const onTemplateChange = useCallback(
    (value: string) => {
      form.setValue('defaultTemplate', value, { shouldDirty: true, shouldValidate: true });
      window.clearTimeout(tplTimer.current);
      tplTimer.current = window.setTimeout(() => void saveTemplateIfValid(), TEMPLATE_DEBOUNCE_MS);
    },
    [form, saveTemplateIfValid],
  );

  const onTemplateBlur = useCallback(() => {
    window.clearTimeout(tplTimer.current);
    void saveTemplateIfValid();
  }, [saveTemplateIfValid]);

  return {
    isLoading,
    isError,
    ready: !!settings,
    values,
    templateError,
    setField,
    onTemplateChange,
    onTemplateBlur,
  };
}
