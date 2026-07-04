import { cn } from '@/shared/lib/utils';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}

export const SegmentedControl = <T extends string>({
  options,
  value,
  onChange,
  disabled,
}: SegmentedControlProps<T>) => (
  <div className="flex gap-1.25 rounded-[9px] bg-background p-0.75">
    {options.map((o) => (
      <button
        key={o.value}
        type="button"
        disabled={disabled}
        onClick={() => onChange(o.value)}
        className={cn(
          'rounded-[7px] px-3.75 py-1.5 text-small font-semibold transition-colors disabled:opacity-50',
          o.value === value
            ? 'bg-panel text-foreground shadow-[0_1px_4px_rgba(0,0,0,.25)]'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        {o.label}
      </button>
    ))}
  </div>
);
