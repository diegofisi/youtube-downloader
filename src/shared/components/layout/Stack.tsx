import type { HTMLAttributes } from 'react';
import { cn } from '@/shared/lib/utils';

type Gap = 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const GAP: Record<Gap, string> = {
  none: 'gap-0',
  xs: 'gap-1',
  sm: 'gap-2',
  md: 'gap-4',
  lg: 'gap-6',
  xl: 'gap-8',
};

const ALIGN = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
} as const;

const JUSTIFY = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
} as const;

interface StackProps extends HTMLAttributes<HTMLDivElement> {
  gap?: Gap;
  direction?: 'row' | 'col';
  align?: keyof typeof ALIGN;
  justify?: keyof typeof JUSTIFY;
  wrap?: boolean;
}

export const Stack = ({
  gap = 'md',
  direction = 'col',
  align,
  justify,
  wrap = false,
  className,
  ...props
}: StackProps) => (
  <div
    className={cn(
      'flex',
      direction === 'col' ? 'flex-col' : 'flex-row',
      GAP[gap],
      align && ALIGN[align],
      justify && JUSTIFY[justify],
      wrap && 'flex-wrap',
      className,
    )}
    {...props}
  />
);
