import type { HTMLAttributes } from 'react';
import { cn } from '@/shared/lib/utils';

const Skeleton = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('animate-pulse rounded-md bg-accent', className)} {...props} />
);

export { Skeleton };
