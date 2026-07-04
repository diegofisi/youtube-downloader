import { SettingsIcon } from 'lucide-react';
import { t } from '@/shared/lib/i18n';
import { cn } from '@/shared/lib/utils';

interface GearButtonProps {
  /** Accent styling when the video carries custom options. */
  hasOverride: boolean;
  onClick: () => void;
}

export const GearButton = ({ hasOverride, onClick }: GearButtonProps) => (
  <button
    type="button"
    title={t('Opciones de este video', 'Options for this video')}
    onClick={(e) => {
      e.stopPropagation();
      onClick();
    }}
    className={cn(
      'flex size-7 flex-none items-center justify-center rounded-lg border transition-colors',
      hasOverride
        ? 'border-primary bg-primary-soft text-primary'
        : 'border-border2 bg-transparent text-muted-foreground hover:text-foreground',
    )}
  >
    <SettingsIcon className="size-4" />
  </button>
);
