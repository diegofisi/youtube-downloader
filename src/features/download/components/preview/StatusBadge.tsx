import { Text } from '@/shared/components/ui/typography';
import { cn } from '@/shared/lib/utils';

interface StatusBadgeProps {
  label: string;
  /** Static Tailwind text+bg classes (from STATUS_META tone). */
  tone: string;
}

export const StatusBadge = ({ label, tone }: StatusBadgeProps) => (
  <Text variant="caption"
    className={cn('inline-flex items-center gap-1.25 rounded-[7px] px-2 py-0.75 font-semibold', tone)}
  >
    <Text variant="inline" className="size-1.25 flex-none rounded-full bg-current" />
    {label}
  </Text>
);
