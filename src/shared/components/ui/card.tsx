import type { HTMLAttributes } from 'react';
import { cn } from '@/shared/lib/utils';

const Card = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('flex flex-col rounded-2xl border border-border bg-card text-card-foreground', className)}
    {...props}
  />
);

const CardHeader = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col gap-1.5 px-5 pt-4 pb-1', className)} {...props} />
);

const CardTitle = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('font-display text-sm font-bold leading-none', className)} {...props} />
);

const CardDescription = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('text-xs text-muted-foreground', className)} {...props} />
);

const CardContent = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('px-5 pb-2', className)} {...props} />
);

const CardFooter = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex items-center px-5 pb-4', className)} {...props} />
);

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
