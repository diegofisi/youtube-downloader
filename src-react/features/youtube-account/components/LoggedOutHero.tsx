import { CheckIcon, SquarePlayIcon } from 'lucide-react';
import { Box } from '@/shared/components/layout/Box';
import { Stack } from '@/shared/components/layout/Stack';
import { Button } from '@/shared/components/ui/button';
import { H2, P, Small, Span } from '@/shared/components/ui/typography';
import { t } from '@/shared/lib/i18n';

interface LoggedOutHeroProps {
  onLogin: () => void;
}

const benefits = () => [
  t('Descarga videos exclusivos para miembros', 'Download members-only videos'),
  t('Accede a tus playlists, “Ver más tarde” y “Me gusta”', 'Access your playlists, “Watch later” and “Liked”'),
  t('Sin extensiones ni copiar cookies a mano', 'No extensions or copying cookies by hand'),
];

/** Logged-out hero of My YouTube: benefits list + sign-in CTA. */
export const LoggedOutHero = ({ onLogin }: LoggedOutHeroProps) => (
  <Stack gap="none" className="mx-auto my-10 max-w-[460px] text-center">
    <Box className="mx-auto mb-[18px] flex size-15 items-center justify-center rounded-2xl bg-destructive-soft text-destructive">
      <SquarePlayIcon className="size-[26px]" />
    </Box>
    <H2 className="mb-2 text-[21px]">{t('Conecta tu cuenta de YouTube', 'Connect your YouTube account')}</H2>
    <P color="muted" className="mb-5 text-[13.5px] leading-[1.55]">
      {t(
        'Inicia sesión una vez para descargar desde tus suscripciones, playlists y contenido exclusivo de miembros.',
        'Sign in once to download from your subscriptions, playlists and members-only content.',
      )}
    </P>
    <Stack gap="sm" className="mb-[22px] gap-2.5 text-left">
      {benefits().map((b) => (
        <Stack
          key={b}
          direction="row"
          gap="sm"
          align="center"
          className="gap-[11px] rounded-[11px] border border-border bg-panel px-3.5 py-3"
        >
          <Span className="flex size-[26px] flex-none items-center justify-center rounded-lg bg-success-soft text-success">
            <CheckIcon className="size-4" />
          </Span>
          <Span className="text-[13px] text-foreground">{b}</Span>
        </Stack>
      ))}
    </Stack>
    <Button
      className="h-[46px] w-full rounded-xl text-sm font-bold shadow-[0_6px_18px_rgba(124,107,240,.3)]"
      onClick={onLogin}
    >
      <SquarePlayIcon className="size-[18px]" />
      {t('Iniciar sesión con YouTube', 'Sign in with YouTube')}
    </Button>
    <Small className="mt-[13px] text-[11.5px] font-normal text-faint">
      {t(
        'Solo se guardan las cookies de sesión, de forma local en este equipo.',
        'Only session cookies are stored, locally on this computer.',
      )}
    </Small>
  </Stack>
);
