import type { ReactNode } from 'react';
import { Loader2Icon } from 'lucide-react';
import { Box } from '@/shared/components/layout/Box';
import { Stack } from '@/shared/components/layout/Stack';
import { Span } from '@/shared/components/ui/typography';

interface GridStateCardProps {
  title: string;
  message?: string;
  /** Spinner row instead of the dashed state card (ports loadingCard). */
  loading?: boolean;
  /** Optional CTA below the message (e.g. a reconnect button). */
  action?: ReactNode;
}

/** Full-width grid state (empty/loading/error) — ports stateCard/loadingCard. */
export const GridStateCard = ({ title, message, loading, action }: GridStateCardProps) => {
  if (loading) {
    return (
      <Stack
        direction="row"
        gap="sm"
        align="center"
        justify="center"
        className="col-span-full p-10 text-[13px] text-muted-foreground"
      >
        <Loader2Icon className="size-4 animate-spin text-primary" />
        <Span>{title}</Span>
      </Stack>
    );
  }

  return (
    <Stack
      gap="none"
      align="center"
      className="col-span-full rounded-2xl border-[1.5px] border-dashed border-border2 px-5 py-12 text-center"
    >
      <Span className="text-sm font-semibold text-muted-foreground">{title}</Span>
      {message && <Span className="mt-[5px] text-[12.5px] text-faint">{message}</Span>}
      {action && <Box className="mt-4">{action}</Box>}
    </Stack>
  );
};
