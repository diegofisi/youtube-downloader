import type { HTMLAttributes } from 'react';
import { cn } from '@/shared/lib/utils';

type Color = 'default' | 'muted' | 'primary' | 'inherit';

const COLOR: Record<Color, string> = {
  default: 'text-foreground',
  muted: 'text-muted-foreground',
  primary: 'text-primary',
  inherit: '',
};

interface TypoProps extends HTMLAttributes<HTMLElement> {
  color?: Color;
}

/* One component = one fixed typographic level; exceptional sizes go via className. */

export const H1 = ({ color = 'default', className, ...p }: TypoProps) => (
  <h1 className={cn('font-display text-2xl font-bold tracking-tight md:text-3xl', COLOR[color], className)} {...p} />
);

export const H2 = ({ color = 'default', className, ...p }: TypoProps) => (
  <h2 className={cn('font-display text-xl font-bold tracking-tight md:text-2xl', COLOR[color], className)} {...p} />
);

export const H3 = ({ color = 'default', className, ...p }: TypoProps) => (
  <h3 className={cn('font-display text-lg font-semibold md:text-xl', COLOR[color], className)} {...p} />
);

export const H4 = ({ color = 'default', className, ...p }: TypoProps) => (
  <h4 className={cn('font-display text-base font-semibold md:text-lg', COLOR[color], className)} {...p} />
);

export const H5 = ({ color = 'default', className, ...p }: TypoProps) => (
  <h5 className={cn('font-display text-sm font-semibold md:text-base', COLOR[color], className)} {...p} />
);

export const H6 = ({ color = 'default', className, ...p }: TypoProps) => (
  <h6 className={cn('font-display text-xs font-semibold md:text-sm', COLOR[color], className)} {...p} />
);

export const P = ({ color = 'inherit', className, ...p }: TypoProps) => (
  <p className={cn('text-sm leading-relaxed lg:text-base', COLOR[color], className)} {...p} />
);

export const Small = ({ color = 'inherit', className, ...p }: TypoProps) => (
  <small className={cn('text-xs font-medium leading-none lg:text-sm', COLOR[color], className)} {...p} />
);

const WEIGHT = {
  normal: 'font-normal',
  medium: 'font-medium',
  semibold: 'font-semibold',
  bold: 'font-bold',
} as const;

interface SpanProps extends TypoProps {
  weight?: keyof typeof WEIGHT;
}

export const Span = ({ color = 'inherit', weight = 'normal', className, ...p }: SpanProps) => (
  <span className={cn(WEIGHT[weight], COLOR[color], className)} {...p} />
);
