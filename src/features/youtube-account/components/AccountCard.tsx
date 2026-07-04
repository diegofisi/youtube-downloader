import { useState } from 'react';
import { Box } from '@/shared/components/layout/Box';
import { Stack } from '@/shared/components/layout/Stack';
import { Button } from '@/shared/components/ui/button';
import { Span } from '@/shared/components/ui/typography';
import { t } from '@/shared/lib/i18n';
import { cn } from '@/shared/lib/utils';

interface AccountCardProps {
  /** null while unknown → generic "YouTube account" presentation. */
  name: string | null;
  handle: string | null;
  avatarUrl: string | null;
  expired: boolean;
  onReconnect: () => void;
  onLogout: () => void;
}

/** Session/account card of My YouTube: avatar, name, Connected/Expired badge,
 * Reconnect (expired only) and Sign out. */
export const AccountCard = ({ name, handle, avatarUrl, expired, onReconnect, onLogout }: AccountCardProps) => {
  // The gradient + "A" stay visible while the avatar loads or if it fails.
  const [avatarFailed, setAvatarFailed] = useState(false);
  const showAvatar = avatarUrl !== null && !avatarFailed;

  const active = t('Sesión activa con cookies', 'Active session with cookies');
  const desc = expired
    ? t(
        'La sesión venció o está incompleta — reconéctate para contenido de miembros',
        'The session expired or is incomplete — reconnect for members-only content',
      )
    : handle
      ? `${handle} · ${active}`
      : active;

  return (
    <Stack
      direction="row"
      gap="md"
      align="center"
      className="mb-5 rounded-[15px] border border-border bg-panel px-[17px] py-[15px]"
    >
      <Box className="flex size-12 flex-none items-center justify-center overflow-hidden rounded-full bg-[linear-gradient(140deg,#6D5BD0,#B36AE2)] text-lg font-bold text-white">
        {showAvatar ? (
          <img
            src={avatarUrl}
            alt=""
            className="size-full rounded-full object-cover"
            onError={() => setAvatarFailed(true)}
          />
        ) : (
          'A'
        )}
      </Box>
      <Stack gap="none" className="min-w-0 flex-1">
        <Stack direction="row" gap="sm" align="center">
          <Span className="font-display truncate text-[15.5px] font-bold">
            {name ?? t('Cuenta de YouTube', 'YouTube account')}
          </Span>
          <Span
            className={cn(
              'inline-flex items-center gap-[5px] rounded-md px-2 py-0.5 text-[11px] font-semibold',
              expired ? 'bg-warn-soft text-warn' : 'bg-success-soft text-success',
            )}
          >
            <Span className="size-1.5 animate-pulse rounded-full bg-current" />
            {expired ? t('Caducada', 'Expired') : t('Conectada', 'Connected')}
          </Span>
        </Stack>
        <Span className="mt-0.5 truncate text-[12.5px] text-muted-foreground">{desc}</Span>
      </Stack>
      {expired && (
        <Button
          size="sm"
          className="h-8.5 rounded-[9px] bg-warn px-[13px] text-[12.5px] font-bold text-[#241600] hover:bg-warn"
          onClick={onReconnect}
        >
          {t('Reconectar', 'Reconnect')}
        </Button>
      )}
      <Button
        variant="outline"
        size="sm"
        className="h-8.5 rounded-[9px] px-[13px] text-[12.5px] font-medium text-destructive hover:text-destructive"
        onClick={onLogout}
      >
        {t('Cerrar sesión', 'Sign out')}
      </Button>
    </Stack>
  );
};
