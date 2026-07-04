import { SettingsIcon } from 'lucide-react';
import { t } from '@/shared/lib/messages/t';
import { cn } from '@/shared/lib/utils';

interface GearButtonProps {
  hasOverride: boolean;
  onClick: () => void;
}

export const GearButton = ({ hasOverride, onClick }: GearButtonProps) => (
  <button
    type="button"
    title={t.download.videoOptions()}
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
