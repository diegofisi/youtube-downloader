import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';

interface QueueActionButtonProps {
  title: string;
  danger?: boolean;
  onClick: () => void;
  children: ReactNode;
}

/** 32px square icon action on a queue item (pause/resume/cancel/retry/folder/remove). */
export const QueueActionButton = ({ title, danger = false, onClick, children }: QueueActionButtonProps) => (
  <button
    type="button"
    title={title}
    onClick={onClick}
    className={cn(
      'flex size-8 items-center justify-center rounded-lg border border-border transition-colors hover:bg-accent',
      danger ? 'text-destructive' : 'text-muted-foreground',
    )}
  >
    {children}
  </button>
);
