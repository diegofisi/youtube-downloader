import { DownloadIcon, FilmIcon, SparklesIcon } from 'lucide-react';
import { Box } from '@/shared/components/layout/Box';
import { Stack } from '@/shared/components/layout/Stack';
import { Button } from '@/shared/components/ui/button';
import { Text } from '@/shared/components/ui/typography';
import { t } from '@/shared/lib/messages/t';
import { cn } from '@/shared/lib/utils';
import { OnboardingStepRow, StepState } from './OnboardingStepRow';

interface OnboardingScreenProps {
  stepsDone: number;
  detail: string;
  detailIsError: boolean;
  finishLabel: string;
  finishEnabled: boolean;
  onFinish: () => void;
  onSkip: () => void;
}

// Function, not constant, so t() reads the current language on render.
const getSteps = () => [
  {
    name: t.setup.step1Title(),
    desc: t.setup.step1Desc(),
    icon: <DownloadIcon className="size-4" />,
  },
  {
    name: t.setup.step2Title(),
    desc: t.setup.step2Desc(),
    icon: <FilmIcon className="size-4" />,
  },
  {
    name: t.setup.step3Title(),
    desc: t.setup.step3Desc(),
    icon: <SparklesIcon className="size-4" />,
  },
];

const stateFor = (index: number, doneCount: number): StepState => {
  if (index < doneCount) return StepState.Done;
  if (index === doneCount) return StepState.Active;
  return StepState.Pending;
};

export const OnboardingScreen = ({
  stepsDone,
  detail,
  detailIsError,
  finishLabel,
  finishEnabled,
  onFinish,
  onSkip,
}: OnboardingScreenProps) => (
  <Box className="fixed inset-0 z-40 flex items-center justify-center bg-background">
    <Box
      className="absolute inset-0"
      style={{ background: 'radial-gradient(900px 500px at 50% 0%, rgba(124,107,240,.12), transparent 70%)' }}
    />
    <Box className="relative w-110 px-6 text-center">
      <Box
        className="mx-auto mb-5.5 flex size-16 items-center justify-center rounded-[18px] shadow-[0_12px_40px_rgba(124,107,240,.4)]"
        style={{ background: 'linear-gradient(150deg, #9385F4, #6B58E8)' }}
      >
        <DownloadIcon className="size-7.5 text-white" />
      </Box>
      <Text variant="h2">{t.setup.welcomeTitle()}</Text>
      <Text variant="body" color="muted" className="mt-2 mb-7 text-sm">
        {t.setup.welcomeSubtitle()}
      </Text>
      <Stack gap="none" className="mb-6.5 gap-2.5 text-left">
        {getSteps().map((step, i) => (
          <OnboardingStepRow
            key={step.name}
            icon={step.icon}
            name={step.name}
            desc={step.desc}
            state={stateFor(i, stepsDone)}
          />
        ))}
      </Stack>
      <Button
        className="h-12 w-full rounded-xl text-body-sm font-bold shadow-[0_8px_24px_rgba(124,107,240,.35)]"
        disabled={!finishEnabled}
        onClick={onFinish}
      >
        {finishLabel}
      </Button>
      <Box className="mt-3.5">
        <button
          type="button"
          className="text-small text-faint transition-colors hover:text-foreground"
          onClick={onSkip}
        >
          {t.setup.skip()}
        </button>
      </Box>
      {detail !== '' && (
        <Text variant="caption"
          className={cn('mt-2.5 block font-normal', detailIsError ? 'text-destructive' : 'text-faint')}
        >
          {detail}
        </Text>
      )}
    </Box>
  </Box>
);
