import { Switch } from '@/shared/components/ui/switch';
import { t } from '@/shared/lib/messages/t';
import { SettingsSection } from './SettingsSection';
import { SettingsRow } from './SettingsRow';

interface BehaviorSectionProps {
  clearLinksAfterPreview: boolean;
  onChange: (value: boolean) => void;
}

export const BehaviorSection = ({ clearLinksAfterPreview, onChange }: BehaviorSectionProps) => (
  <SettingsSection title={t.settings.behavior()}>
    <SettingsRow
      title={t.settings.clearLinks()}
      description={t.settings.clearLinksHint()}
    >
      <Switch checked={clearLinksAfterPreview} onCheckedChange={onChange} />
    </SettingsRow>
  </SettingsSection>
);
