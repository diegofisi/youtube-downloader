import type { ElementType, HTMLAttributes } from 'react';
import { cn } from '@/shared/lib/utils';

interface BoxProps extends HTMLAttributes<HTMLElement> {
  /** Semantic tag when it matters (nav, main, section...). */
  as?: ElementType;
}

/** Polymorphic semantic wrapper — replaces the generic `<div>`. */
export const Box = ({ as: Tag = 'div', className, ...props }: BoxProps) => <Tag className={cn(className)} {...props} />;
