import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TriangleAlertIcon, XIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Stack } from '@/shared/components/layout/Stack';
import { Span } from '@/shared/components/ui/typography';
import { t } from '@/shared/lib/i18n';
import { AppPath } from '@/shared/routes/app-path';
import { SessionStatus } from '../models/session-status.model';
import { useSessionStatus } from '../api/get-session-status/useSessionStatus';
import { openYouTubeLogin } from '../api/open-youtube-login/openYouTubeLogin';

/** Shell banner shown while the YouTube session is expired (vanilla shell.ts port):
 * dismissable, and "Reconectar" navigates to Mi YouTube + opens the login window. */
export const SessionExpiredBanner = () => {
  const navigate = useNavigate();
  const { data: status } = useSessionStatus();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Reconnecting clears the dismissal, like the vanilla session:connected handler.
    if (status === SessionStatus.Connected) setDismissed(false);
  }, [status]);

  if (status !== SessionStatus.Expired || dismissed) return null;

  const onReconnect = () => {
    setDismissed(true); // vanilla hides the banner as soon as reconnect is clicked
    void navigate(AppPath.YOUTUBE);
    openYouTubeLogin().catch(() => toast.error(t('No se pudo abrir el login', 'Could not open login')));
  };

  return (
    <Stack
      direction="row"
      align="center"
      gap="none"
      className="z-4 flex-none gap-2.75 border-b bg-warn-soft px-4 py-2.25"
      style={{ borderBottomColor: 'color-mix(in srgb, var(--warn) 32%, transparent)' }}
    >
      <TriangleAlertIcon className="size-3.75 flex-none text-warn" />
      <Span className="min-w-0 flex-1 text-[12.5px] text-foreground">
        {t(
          'Tu sesión de YouTube caducó. Vuelve a conectarte para el contenido de miembros.',
          'Your YouTube session expired. Reconnect to access members-only content.',
        )}
      </Span>
      <button
        type="button"
        onClick={onReconnect}
        className="h-7.5 flex-none rounded-lg bg-warn px-3.5 text-xs font-bold whitespace-nowrap text-[#241600] hover:brightness-105"
      >
        {t('Reconectar', 'Reconnect')}
      </button>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        title={t('Descartar', 'Dismiss')}
        className="flex size-7 flex-none items-center justify-center rounded-[7px] text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <XIcon className="size-4" />
      </button>
    </Stack>
  );
};
