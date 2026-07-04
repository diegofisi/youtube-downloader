import { Span } from '@/shared/components/ui/typography';
import { cn } from '@/shared/lib/utils';

interface StatusBadgeProps {
  label: string;
  /** Static Tailwind text+bg classes (from STATUS_META tone). */
  tone: string;
}

export const StatusBadge = ({ label, tone }: StatusBadgeProps) => (
  <Span
    className={cn('inline-flex items-center gap-[5px] rounded-[7px] px-2 py-[3px] text-[11px] font-semibold', tone)}
  >
    <Span className="size-[5px] flex-none rounded-full bg-current" />
    {label}
  </Span>
);
