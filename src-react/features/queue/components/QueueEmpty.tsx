import { Box } from '@/shared/components/layout/Box';
import { Small } from '@/shared/components/ui/typography';
import { t } from '@/shared/lib/i18n';

/** Dashed empty state — vanilla #queue-empty design, richer than shared PageEmpty. */
export const QueueEmpty = () => (
  <Box className="rounded-2xl border-[1.5px] border-dashed border-border2 px-5 py-14 text-center text-faint">
    <Small className="block text-sm font-semibold" color="muted">
      {t('La cola está vacía', 'The queue is empty')}
    </Small>
    <Small className="mt-1.25 block text-[12.5px] font-normal">
      {t('Lo que descargues aparecerá aquí con su progreso en vivo.', 'Your downloads will show up here with live progress.')}
    </Small>
  </Box>
);
