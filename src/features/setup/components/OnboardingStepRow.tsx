import type { ReactNode } from 'react';
import { CheckIcon, Loader2Icon } from 'lucide-react';
import { Box } from '@/shared/components/layout/Box';
import { Stack } from '@/shared/components/layout/Stack';
import { Text } from '@/shared/components/ui/typography';
import { cn } from '@/shared/lib/utils';

export const StepState = {
  Done: 'done',
  Active: 'active',
  Pending: 'pending',
} as const;
export type StepState = (typeof StepState)[keyof typeof StepState];

interface OnboardingStepRowProps {
  icon: ReactNode;
  name: string;
  desc: string;
  state: StepState;
}

export const OnboardingStepRow = ({ icon, name, desc, state }: OnboardingStepRowProps) => (
  <Stack
    direction="row"
    align="center"
    gap="none"
    className="gap-3.25 rounded-[13px] border border-border bg-panel px-3.75 py-3.25"
  >
    <Box
      className={cn(
        'flex size-7.5 flex-none items-center justify-center rounded-[9px] bg-panel2',
        state === StepState.Done ? 'text-success' : 'text-muted-foreground',
      )}
    >
      {icon}
    </Box>
    <Stack gap="none" className="min-w-0 flex-1">
      <Text variant="body-sm" className=" font-semibold leading-normal">{name}</Text>
      <Text variant="caption" color="muted" className=" font-normal leading-normal">
        {desc}
      </Text>
    </Stack>
    {state === StepState.Done && (
      <Box className="flex size-6 flex-none items-center justify-center rounded-full bg-success text-success-foreground">
        <CheckIcon className="size-3.5" />
      </Box>
    )}
    {state === StepState.Active && <Loader2Icon className="size-4 flex-none animate-spin text-primary" />}
    {state === StepState.Pending && <Box className="size-2 flex-none rounded-full bg-border2" />}
  </Stack>
);
