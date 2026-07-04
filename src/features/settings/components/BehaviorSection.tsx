import { Switch } from '@/shared/components/ui/switch';
import { t } from '@/shared/lib/i18n';
import { SettingsSection } from './SettingsSection';
import { SettingsRow } from './SettingsRow';

interface BehaviorSectionProps {
  clearLinksAfterPreview: boolean;
  onChange: (value: boolean) => void;
}

export const BehaviorSection = ({ clearLinksAfterPreview, onChange }: BehaviorSectionProps) => (
  <SettingsSection title={t('Comportamiento', 'Behavior')}>
    <SettingsRow
      title={t('Limpiar enlaces al previsualizar', 'Clear links after preview')}
      description={t(
        'Vacía el cuadro de enlaces después de generar la vista previa',
        'Empties the link box after generating the preview',
      )}
    >
      <Switch checked={clearLinksAfterPreview} onCheckedChange={onChange} />
    </SettingsRow>
  </SettingsSection>
);
