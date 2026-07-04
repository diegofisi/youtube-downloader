import { CheckIcon, SquarePlayIcon } from 'lucide-react';
import { Box } from '@/shared/components/layout/Box';
import { Stack } from '@/shared/components/layout/Stack';
import { Button } from '@/shared/components/ui/button';
import { Text } from '@/shared/components/ui/typography';
import { t } from '@/shared/lib/messages/t';

interface LoggedOutHeroProps {
  onLogin: () => void;
}

const benefits = () => [
  t.youtube.benefit1(),
  t.youtube.benefit2(),
  t.youtube.benefit3(),
];

export const LoggedOutHero = ({ onLogin }: LoggedOutHeroProps) => (
  <Stack gap="none" className="mx-auto my-10 max-w-115 text-center">
    <Box className="mx-auto mb-4.5 flex size-15 items-center justify-center rounded-2xl bg-destructive-soft text-destructive">
      <SquarePlayIcon className="size-6.5" />
    </Box>
    <Text variant="h2" className="mb-2">{t.youtube.heroTitle()}</Text>
    <Text variant="body-sm" color="muted" className="mb-5 leading-[1.55]">
      {t.youtube.heroSubtitle()}
    </Text>
    <Stack gap="sm" className="mb-5.5 gap-2.5 text-left">
      {benefits().map((b) => (
        <Stack
          key={b}
          direction="row"
          gap="sm"
          align="center"
          className="gap-2.75 rounded-[11px] border border-border bg-panel px-3.5 py-3"
        >
          <Text variant="inline" className="flex size-6.5 flex-none items-center justify-center rounded-lg bg-success-soft text-success">
            <CheckIcon className="size-4" />
          </Text>
          <Text variant="body-sm" className=" text-foreground">{b}</Text>
        </Stack>
      ))}
    </Stack>
    <Button
      className="h-11.5 w-full rounded-xl text-sm font-bold shadow-[0_6px_18px_rgba(124,107,240,.3)]"
      onClick={onLogin}
    >
      <SquarePlayIcon className="size-4.5" />
      {t.youtube.loginButton()}
    </Button>
    <Text variant="caption" className="mt-3.25 font-normal text-faint">
      {t.youtube.privacyNote()}
    </Text>
  </Stack>
);
