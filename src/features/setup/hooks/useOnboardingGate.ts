import { useCallback, useEffect, useRef, useState } from 'react';
import { t } from '@/shared/lib/messages/t';
import { useTauriEvent } from '@/shared/hooks/useTauriEvent';
import { useCheckDependencies } from '../api/check-dependencies/useCheckDependencies';
import { useDownloadDependencies } from '../api/download-dependencies/useDownloadDependencies';
import type { SetupProgress } from '../models/setup-progress.model';

export const OnboardingPhase = {
  Checking: 'checking',
  Open: 'open',
  Done: 'done',
} as const;
export type OnboardingPhase = (typeof OnboardingPhase)[keyof typeof OnboardingPhase];

// Legacy key shared with the vanilla app — keep until migrated.
const ONBOARDED_KEY = 'stash-onboarded';
const FAKE_STEP_MS = 520;
const TOTAL_STEPS = 3;

const wasOnboarded = (): boolean => {
  try {
    return localStorage.getItem(ONBOARDED_KEY) !== null;
  } catch {
    return false;
  }
};

const markOnboarded = (): void => {
  try {
    localStorage.setItem(ONBOARDED_KEY, '1');
  } catch {
    // ignore persistence errors
  }
};

export function useOnboardingGate() {
  const { data: status } = useCheckDependencies();
  const { mutate: install, isPending: installing } = useDownloadDependencies();
  const [phase, setPhase] = useState<OnboardingPhase>(OnboardingPhase.Checking);
  const [stepsDone, setStepsDone] = useState(0);
  const [detail, setDetail] = useState('');
  const [retryMode, setRetryMode] = useState(false);
  const [finishEnabled, setFinishEnabled] = useState(false);
  const bootedRef = useRef(false); // guards StrictMode double-effect + refetches
  const timersRef = useRef<number[]>([]);

  useTauriEvent<SetupProgress>('setup-progress', (p) => {
    // Only react to OUR install: the Ajustes repair emits the same event.
    if (!installing) return;
    if (p.step === 'ffmpeg') setStepsDone(1);
    if (p.step === 'deno') setStepsDone(2);
    if (p.step === 'done') setStepsDone(TOTAL_STEPS);
    setDetail(p.message);
  });

  const runInstall = useCallback(() => {
    setRetryMode(false);
    setFinishEnabled(false);
    setDetail('');
    setStepsDone(0);
    install(undefined, {
      onSuccess: () => {
        setStepsDone(TOTAL_STEPS);
        setDetail('');
        setFinishEnabled(true);
      },
      onError: (e) => {
        // Keep the error visible and offer retry; don't continue as if all went well.
        setDetail(`${t.common.error()}: ${String(e)}`);
        setRetryMode(true);
        setFinishEnabled(true);
      },
    });
  }, [install]);

  useEffect(() => {
    if (status === undefined || bootedRef.current) return;
    bootedRef.current = true;
    if (status.ready && wasOnboarded()) {
      setPhase(OnboardingPhase.Done);
      return;
    }
    markOnboarded(); // vanilla sets the flag as soon as the screen is shown
    setPhase(OnboardingPhase.Open);
    if (!status.ready) {
      runInstall();
      return;
    }
    // Deps already there but first boot: play the steps as a welcome animation.
    for (let i = 1; i <= TOTAL_STEPS; i++) {
      timersRef.current.push(
        window.setTimeout(() => {
          setStepsDone(i);
          if (i === TOTAL_STEPS) setFinishEnabled(true);
        }, i * FAKE_STEP_MS),
      );
    }
  }, [status, runInstall]);

  useEffect(
    () => () => {
      timersRef.current.forEach((id) => clearTimeout(id));
    },
    [],
  );

  const onFinish = useCallback(() => {
    if (retryMode) {
      runInstall();
      return;
    }
    setPhase(OnboardingPhase.Done);
  }, [retryMode, runInstall]);

  const onSkip = useCallback(() => setPhase(OnboardingPhase.Done), []);

  return {
    phase,
    stepsDone,
    detail,
    detailIsError: retryMode,
    finishLabel: retryMode ? t.common.retry() : t.setup.finish(),
    finishEnabled,
    onFinish,
    onSkip,
  };
}
