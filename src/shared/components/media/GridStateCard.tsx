import type { ReactNode } from 'react';
import { Loader2Icon } from 'lucide-react';
import { Box } from '@/shared/components/layout/Box';
import { Stack } from '@/shared/components/layout/Stack';
import { Text } from '@/shared/components/ui/typography';

interface GridStateCardProps {
  title: string;
  message?: string;
  loading?: boolean;
  action?: ReactNode;
}

export const GridStateCard = ({ title, message, loading, action }: GridStateCardProps) => {
  if (loading) {
    return (
      <Stack
        direction="row"
        gap="sm"
        align="center"
        justify="center"
        className="col-span-full p-10 text-body-sm text-muted-foreground"
      >
        <Loader2Icon className="size-4 animate-spin text-primary" />
        <Text variant="inline">{title}</Text>
      </Stack>
    );
  }

  return (
    <Stack
      gap="none"
      align="center"
      className="col-span-full rounded-2xl border-[1.5px] border-dashed border-border2 px-5 py-12 text-center"
    >
      <Text variant="inline" className="text-sm font-semibold text-muted-foreground">{title}</Text>
      {message && <Text variant="small" className="mt-1.25 text-faint">{message}</Text>}
      {action && <Box className="mt-4">{action}</Box>}
    </Stack>
  );
};
