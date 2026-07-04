import { Loader2Icon } from 'lucide-react';
import { Stack } from '@/shared/components/layout/Stack';
import { Text } from '@/shared/components/ui/typography';

interface PageLoadingProps {
  message?: string;
}

export const PageLoading = ({ message = 'Cargando...' }: PageLoadingProps) => (
  <Stack gap="sm" align="center" justify="center" className="py-12">
    <Loader2Icon className="size-5 animate-spin text-primary" />
    <Text variant="body" color="muted">{message}</Text>
  </Stack>
);
