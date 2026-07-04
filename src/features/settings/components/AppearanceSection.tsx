import { SegmentedControl } from '@/shared/components/ui/SegmentedControl';
import type { Lang } from '@/shared/lib/i18n';
import { t } from '@/shared/lib/messages/t';
import type { Theme } from '@/shared/stores/useUiStore';
import { SettingsSection } from './SettingsSection';
import { SettingsRow } from './SettingsRow';

interface AppearanceSectionProps {
  lang: Lang;
  theme: Theme;
  concurrency: number;
  onLangChange: (lang: Lang) => void;
  onThemeChange: (theme: Theme) => void;
  onConcurrencyChange: (value: number) => void;
}

export const AppearanceSection = ({
  lang,
  theme,
  concurrency,
  onLangChange,
  onThemeChange,
  onConcurrencyChange,
}: AppearanceSectionProps) => (
  <SettingsSection title={t.settings.appearance()}>
    <SettingsRow title="Idioma / Language" description={t.settings.appearanceHint()}>
      <SegmentedControl
        options={[
          { value: 'es', label: 'Español' },
          { value: 'en', label: 'English' },
        ]}
        value={lang}
        onChange={onLangChange}
      />
    </SettingsRow>
    <SettingsRow title={t.settings.theme()} description={t.settings.themeHint()}>
      <SegmentedControl
        options={[
          { value: 'dark', label: t.settings.dark() },
          { value: 'light', label: t.settings.light() },
        ]}
        value={theme}
        onChange={onThemeChange}
      />
    </SettingsRow>
    <SettingsRow
      title={t.settings.concurrency()}
      description={t.settings.concurrencyHint()}
    >
      <SegmentedControl
        options={[
          { value: '5', label: '5' },
          { value: '10', label: '10' },
          { value: '20', label: '20' },
          { value: '50', label: '50' },
          { value: '0', label: t.settings.concurrencyAll() },
        ]}
        value={String(concurrency)}
        onChange={(v) => onConcurrencyChange(parseInt(v, 10))}
      />
    </SettingsRow>
  </SettingsSection>
);
