import type { ReactNode } from 'react';
import { IconButton } from '@/shared/components/ui/IconButton';

interface QueueActionButtonProps {
  title: string;
  danger?: boolean;
  onClick: () => void;
  children: ReactNode;
}

export const QueueActionButton = ({ title, danger = false, onClick, children }: QueueActionButtonProps) => (
  <IconButton title={title} onClick={onClick} tone={danger ? 'danger' : 'muted'}>
    {children}
  </IconButton>
);
