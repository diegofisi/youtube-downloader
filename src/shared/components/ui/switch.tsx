import type { ComponentProps } from 'react';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import { cn } from '@/shared/lib/utils';

/** Styled to match the Stash toggle (38x22, white knob, accent when on). */
const Switch = ({ className, ...props }: ComponentProps<typeof SwitchPrimitive.Root>) => (
  <SwitchPrimitive.Root
    className={cn(
      'peer inline-flex h-[22px] w-[38px] shrink-0 items-center rounded-full p-[2px] transition-colors outline-none',
      'focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50',
      'data-[state=checked]:bg-primary data-[state=unchecked]:bg-border2',
      className,
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb
      className={cn(
        'pointer-events-none block size-[18px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.3)] transition-transform',
        'data-[state=checked]:translate-x-[16px] data-[state=unchecked]:translate-x-0',
      )}
    />
  </SwitchPrimitive.Root>
);

export { Switch };
