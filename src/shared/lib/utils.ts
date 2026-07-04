import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// Register the fluid --text-* tokens as font-size utilities so tailwind-merge
// treats e.g. `text-h1` as a size (not a color) and won't drop it on merge.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        { text: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'lead', 'body', 'body-sm', 'small', 'caption', 'micro'] },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
