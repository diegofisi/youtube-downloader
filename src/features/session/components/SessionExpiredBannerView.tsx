import { TriangleAlertIcon, XIcon } from 'lucide-react';
import { Stack } from '@/shared/components/layout/Stack';
import { Text } from '@/shared/components/ui/typography';
import { t } from '@/shared/lib/messages/t';

interface SessionExpiredBannerViewProps {
  onReconnect: () => void;
  onDismiss: () => void;
}

export const SessionExpiredBannerView = ({ onReconnect, onDismiss }: SessionExpiredBannerViewProps) => (
  <Stack
    direction="row"
    align="center"
    gap="none"
    className="z-4 flex-none gap-2.75 border-b border-warn/32 bg-warn-soft px-4 py-2.25 transition duration-200 starting:-translate-y-1 starting:opacity-0"
  >
    <TriangleAlertIcon className="size-3.75 flex-none text-warn" />
    <Text variant="caption" className="min-w-0 flex-1 text-foreground">
      {t.session.expiredBanner()}
    </Text>
    <button
      type="button"
      onClick={onReconnect}
      className="h-7.5 flex-none rounded-lg bg-warn px-3.5 text-xs font-bold whitespace-nowrap text-warn-foreground hover:brightness-105"
    >
      {t.common.reconnect()}
    </button>
    <button
      type="button"
      onClick={onDismiss}
      title={t.session.dismiss()}
      className="flex size-7 flex-none items-center justify-center rounded-[7px] text-muted-foreground hover:bg-accent hover:text-foreground"
    >
      <XIcon className="size-4" />
    </button>
  </Stack>
);
