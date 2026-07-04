import { CheckIcon } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

interface SelectToggleProps {
  on: boolean;
  /** Non-downloadable videos render the box but ignore clicks (vanilla parity). */
  disabled?: boolean;
  onToggle: () => void;
}

export const SelectToggle = ({ on, disabled, onToggle }: SelectToggleProps) => (
  <button
    type="button"
    onClick={(e) => {
      e.stopPropagation();
      if (!disabled) onToggle();
    }}
    className={cn(
      'flex size-[22px] flex-none items-center justify-center rounded-[7px] border-[1.8px] transition-colors',
      on ? 'border-primary bg-primary text-primary-foreground' : 'border-border2 bg-transparent',
    )}
  >
    {on && <CheckIcon className="size-3.5" strokeWidth={3} />}
  </button>
);
