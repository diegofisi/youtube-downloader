import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';

type IconButtonTone = 'default' | 'muted' | 'danger';

const TONE: Record<IconButtonTone, string> = {
  default: 'text-muted-foreground hover:text-foreground',
  muted: 'text-muted-foreground',
  danger: 'text-destructive',
};

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: IconButtonTone;
  children: ReactNode;
}

// Shared here because the same pattern is used across features, which may not import each other.
export const IconButton = ({ tone = 'default', type = 'button', className, children, ...props }: IconButtonProps) => (
  <button
    type={type}
    className={cn(
      'flex size-8 items-center justify-center rounded-lg border border-border transition-colors hover:bg-accent',
      TONE[tone],
      className,
    )}
    {...props}
  >
    {children}
  </button>
);
