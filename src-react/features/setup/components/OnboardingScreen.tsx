import { DownloadIcon, FilmIcon, SparklesIcon } from 'lucide-react';
import { Box } from '@/shared/components/layout/Box';
import { Stack } from '@/shared/components/layout/Stack';
import { Button } from '@/shared/components/ui/button';
import { H1, P, Small } from '@/shared/components/ui/typography';
import { t } from '@/shared/lib/i18n';
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

// Lazy (function, not constant) so t() reads the current language on render.
const getSteps = () => [
  {
    name: t('Preparando el descargador', 'Setting up the downloader'),
    desc: t('Listo para bajar videos de YouTube', 'Ready to download YouTube videos'),
    icon: <DownloadIcon className="size-4" />,
  },
  {
    name: t('Activando la alta calidad', 'Enabling high quality'),
    desc: t('Video y audio en su mejor versión', 'Video and audio at their best'),
    icon: <FilmIcon className="size-4" />,
  },
  {
    name: t('Casi listo', 'Almost ready'),
    desc: t('Dando los últimos toques', 'Adding the finishing touches'),
    icon: <SparklesIcon className="size-4" />,
  },
];

const stateFor = (index: number, doneCount: number): StepState => {
  if (index < doneCount) return StepState.Done;
  if (index === doneCount) return StepState.Active;
  return StepState.Pending;
};

/** Full-screen first-run overlay (mirrors the vanilla #onboarding markup). */
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
    <Box className="relative w-[440px] px-6 text-center">
      <Box
        className="mx-auto mb-[22px] flex size-16 items-center justify-center rounded-[18px] shadow-[0_12px_40px_rgba(124,107,240,.4)]"
        style={{ background: 'linear-gradient(150deg, #9385F4, #6B58E8)' }}
      >
        <DownloadIcon className="size-[30px] text-white" />
      </Box>
      <H1 className="text-[27px] tracking-[-0.5px]">{t('Bienvenido a Stash', 'Welcome to Stash')}</H1>
      <P color="muted" className="mt-2 mb-7 text-sm">
        {t(
          'Preparamos todo la primera vez. Tarda solo unos segundos.',
          'We set everything up the first time. It only takes a few seconds.',
        )}
      </P>
      <Stack gap="none" className="mb-[26px] gap-2.5 text-left">
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
        className="h-12 w-full rounded-xl text-[14.5px] font-bold shadow-[0_8px_24px_rgba(124,107,240,.35)]"
        disabled={!finishEnabled}
        onClick={onFinish}
      >
        {finishLabel}
      </Button>
      <Box className="mt-3.5">
        <button type="button" className="text-[12.5px] text-faint transition-colors hover:text-foreground" onClick={onSkip}>
          {t('Omitir e ir a la app', 'Skip and go to the app')}
        </button>
      </Box>
      {detail !== '' && (
        <Small
          className={cn('mt-2.5 block text-[11.5px] font-normal', detailIsError ? 'text-destructive' : 'text-faint')}
        >
          {detail}
        </Small>
      )}
    </Box>
  </Box>
);
