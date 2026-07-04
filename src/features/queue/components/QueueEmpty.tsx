import { Box } from '@/shared/components/layout/Box';
import { Text } from '@/shared/components/ui/typography';
import { t } from '@/shared/lib/messages/t';

// Own empty state, not shared PageEmpty: the vanilla #queue-empty design is richer.
export const QueueEmpty = () => (
  <Box className="rounded-2xl border-[1.5px] border-dashed border-border2 px-5 py-14 text-center text-faint">
    <Text variant="small" className="block text-sm font-semibold" color="muted">
      {t.queue.emptyTitle()}
    </Text>
    <Text variant="small" className="mt-1.25 block font-normal">
      {t.queue.emptySubtitle()}
    </Text>
  </Box>
);
