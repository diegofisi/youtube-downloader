import { InboxIcon } from 'lucide-react';
import { Stack } from '@/shared/components/layout/Stack';
import { P } from '@/shared/components/ui/typography';

interface PageEmptyProps {
  message?: string;
}

export const PageEmpty = ({ message = 'Sin resultados.' }: PageEmptyProps) => (
  <Stack gap="sm" align="center" justify="center" className="py-12">
    <InboxIcon className="size-5 text-faint" />
    <P color="muted">{message}</P>
  </Stack>
);
