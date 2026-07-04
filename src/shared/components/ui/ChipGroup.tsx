import { cn } from '@/shared/lib/utils';

export interface ChipOption<T extends string> {
  value: T;
  label: string;
}

interface ChipGroupProps<T extends string> {
  options: ChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}

/** Stash chip group: accent border when active (ports the vanilla `renderChipGroup`, compact pad). */
export const ChipGroup = <T extends string>({ options, value, onChange, disabled }: ChipGroupProps<T>) => (
  <div className="flex flex-wrap justify-end gap-1.25">
    {options.map((o) => (
      <button
        key={o.value}
        type="button"
        disabled={disabled}
        onClick={() => onChange(o.value)}
        className={cn(
          'rounded-lg border-[1.5px] px-2.75 py-1.25 text-xs font-semibold transition-colors disabled:opacity-50',
          o.value === value
            ? 'border-primary bg-primary-soft text-primary'
            : 'border-border bg-transparent text-muted-foreground hover:text-foreground',
        )}
      >
        {o.label}
      </button>
    ))}
  </div>
);
