import { AlertTriangleIcon } from 'lucide-react';
import { Stack } from '@/shared/components/layout/Stack';
import { Text } from '@/shared/components/ui/typography';

interface PageErrorProps {
  message?: string;
}

export const PageError = ({ message = 'Ha ocurrido un error.' }: PageErrorProps) => (
  <Stack gap="sm" align="center" justify="center" className="py-12">
    <AlertTriangleIcon className="size-5 text-destructive" />
    <Text variant="body" color="muted">{message}</Text>
  </Stack>
);
