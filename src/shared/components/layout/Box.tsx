import type { ElementType, HTMLAttributes } from 'react';
import { cn } from '@/shared/lib/utils';

interface BoxProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
}

export const Box = ({ as: Tag = 'div', className, ...props }: BoxProps) => <Tag className={cn(className)} {...props} />;
