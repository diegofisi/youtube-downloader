import { SegmentedControl } from '@/shared/components/ui/SegmentedControl';
import { t, type Lang } from '@/shared/lib/i18n';
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
  <SettingsSection title={t('Apariencia', 'Appearance')}>
    <SettingsRow title="Idioma / Language" description={t('Se aplica al instante', 'Applies instantly')}>
      <SegmentedControl
        options={[
          { value: 'es', label: 'Español' },
          { value: 'en', label: 'English' },
        ]}
        value={lang}
        onChange={onLangChange}
      />
    </SettingsRow>
    <SettingsRow title={t('Tema', 'Theme')} description={t('Claro u oscuro', 'Light or dark')}>
      <SegmentedControl
        options={[
          { value: 'dark', label: t('Oscuro', 'Dark') },
          { value: 'light', label: t('Claro', 'Light') },
        ]}
        value={theme}
        onChange={onThemeChange}
      />
    </SettingsRow>
    <SettingsRow
      title={t('Descargas simultáneas', 'Simultaneous downloads')}
      description={t('Cuántos videos a la vez', 'How many videos at once')}
    >
      <SegmentedControl
        options={[
          { value: '5', label: '5' },
          { value: '10', label: '10' },
          { value: '20', label: '20' },
          { value: '50', label: '50' },
          { value: '0', label: t('Todos', 'All') },
        ]}
        value={String(concurrency)}
        onChange={(v) => onConcurrencyChange(parseInt(v, 10))}
      />
    </SettingsRow>
  </SettingsSection>
);
