import type { InputHTMLAttributes } from 'react';
import { cn } from '@/shared/lib/utils';

const Input = ({ className, type, ...props }: InputHTMLAttributes<HTMLInputElement>) => (
  <input
    type={type}
    className={cn(
      'flex h-9 w-full min-w-0 rounded-lg border border-border bg-background px-3 py-1 text-sm text-foreground shadow-xs transition-colors outline-none',
      'placeholder:text-faint selection:bg-primary/30',
      'focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/30',
      'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
      'aria-invalid:border-destructive aria-invalid:ring-destructive/20',
      className,
    )}
    {...props}
  />
);

export { Input };
