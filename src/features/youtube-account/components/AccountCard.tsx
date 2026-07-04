import { useState } from 'react';
import { Box } from '@/shared/components/layout/Box';
import { Stack } from '@/shared/components/layout/Stack';
import { Button } from '@/shared/components/ui/button';
import { Text } from '@/shared/components/ui/typography';
import { t } from '@/shared/lib/messages/t';
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

export const AccountCard = ({ name, handle, avatarUrl, expired, onReconnect, onLogout }: AccountCardProps) => {
  // The gradient + "A" stay visible while the avatar loads or if it fails.
  const [avatarFailed, setAvatarFailed] = useState(false);
  const showAvatar = avatarUrl !== null && !avatarFailed;

  const active = t.youtube.sessionActive();
  const desc = expired
    ? t.youtube.sessionExpiredDesc()
    : handle
      ? `${handle} · ${active}`
      : active;

  return (
    <Stack
      direction="row"
      gap="md"
      align="center"
      className="mb-5 rounded-[15px] border border-border bg-panel px-4.25 py-3.75"
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
          <Text variant="inline" className="font-display truncate text-body font-bold">
            {name ?? t.youtube.accountFallbackName()}
          </Text>
          <Text variant="caption"
            className={cn(
              'inline-flex items-center gap-1.25 rounded-md px-2 py-0.5 font-semibold',
              expired ? 'bg-warn-soft text-warn' : 'bg-success-soft text-success',
            )}
          >
            <Text variant="inline" className="size-1.5 animate-pulse rounded-full bg-current" />
            {expired ? t.youtube.badgeExpired() : t.youtube.badgeConnected()}
          </Text>
        </Stack>
        <Text variant="small" className="mt-0.5 truncate text-muted-foreground">{desc}</Text>
      </Stack>
      {expired && (
        <Button
          size="sm"
          className="h-8.5 rounded-[9px] bg-warn px-3.25 text-small font-bold text-warn-foreground hover:bg-warn"
          onClick={onReconnect}
        >
          {t.common.reconnect()}
        </Button>
      )}
      <Button
        variant="outline"
        size="sm"
        className="h-8.5 rounded-[9px] px-3.25 text-small font-medium text-destructive hover:text-destructive"
        onClick={onLogout}
      >
        {t.youtube.logout()}
      </Button>
    </Stack>
  );
};
