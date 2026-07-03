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

const COLS = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  6: 'grid-cols-6',
  12: 'grid-cols-12',
} as const;

interface GridProps extends HTMLAttributes<HTMLDivElement> {
  cols?: keyof typeof COLS;
  gap?: Gap;
}

/** Grid container for layouts — replaces raw `<div>` with grid. */
export const Grid = ({ cols = 2, gap = 'md', className, ...props }: GridProps) => (
  <div className={cn('grid', COLS[cols], GAP[gap], className)} {...props} />
);
