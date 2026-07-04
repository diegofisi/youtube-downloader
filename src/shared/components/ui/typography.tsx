import type { ElementType, HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/shared/lib/utils';

// Sizes come from fluid --text-* clamp() tokens; add a variant here, never an inline text-[..px] at the call site.
const textVariants = cva('', {
  variants: {
    variant: {
      h1: 'font-display text-h1 font-bold',
      h2: 'font-display text-h2 font-bold',
      h3: 'font-display text-h3 font-semibold',
      h4: 'font-display text-h4 font-semibold',
      h5: 'font-display text-h5 font-semibold',
      h6: 'font-display text-h6 font-semibold',
      lead: 'text-lead',
      body: 'text-body',
      'body-sm': 'text-body-sm',
      small: 'text-small font-medium',
      caption: 'text-caption',
      micro: 'text-micro',
      code: 'font-mono text-body-sm',
      inline: '', // inherits size from the parent
    },
    color: {
      default: 'text-foreground',
      muted: 'text-muted-foreground',
      primary: 'text-primary',
      inherit: '',
    },
    weight: {
      normal: 'font-normal',
      medium: 'font-medium',
      semibold: 'font-semibold',
      bold: 'font-bold',
    },
  },
  defaultVariants: { variant: 'body', color: 'inherit' },
});

type TextVariant = NonNullable<VariantProps<typeof textVariants>['variant']>;

type TextElement =
  | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
  | 'p' | 'span' | 'small' | 'label' | 'code' | 'div' | 'blockquote';

// Each variant's default semantic tag; override with `as` when the look must differ from the element.
const VARIANT_TAG: Record<TextVariant, TextElement> = {
  h1: 'h1', h2: 'h2', h3: 'h3', h4: 'h4', h5: 'h5', h6: 'h6',
  lead: 'p', body: 'p', 'body-sm': 'p', small: 'small', caption: 'span',
  micro: 'span', code: 'code', inline: 'span',
};

interface TextProps
  extends Omit<HTMLAttributes<HTMLElement>, 'color'>, // HTML's legacy `color` attr collides with our variant
    VariantProps<typeof textVariants> {
  as?: TextElement;
}

export const Text = ({ variant, color, weight, as, className, ...props }: TextProps) => {
  const Tag = (as ?? VARIANT_TAG[variant ?? 'body']) as ElementType;
  return <Tag className={cn(textVariants({ variant, color, weight }), className)} {...props} />;
};
