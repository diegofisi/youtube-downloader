import type { ReactNode } from 'react';
import { OnboardingPhase, useOnboardingGate } from '../hooks/useOnboardingGate';
import { OnboardingScreen } from '../components/OnboardingScreen';

interface OnboardingGateProps {
  children: ReactNode;
}

// The app shell stays mounted underneath (like the vanilla overlay), so
// "Omitir" reveals it instantly and global wiring is never delayed.
export const OnboardingGate = ({ children }: OnboardingGateProps) => {
  const gate = useOnboardingGate();

  return (
    <>
      {children}
      {gate.phase === OnboardingPhase.Open && (
        <OnboardingScreen
          stepsDone={gate.stepsDone}
          detail={gate.detail}
          detailIsError={gate.detailIsError}
          finishLabel={gate.finishLabel}
          finishEnabled={gate.finishEnabled}
          onFinish={gate.onFinish}
          onSkip={gate.onSkip}
        />
      )}
    </>
  );
};
