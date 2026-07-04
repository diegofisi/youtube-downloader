import { CheckIcon, DownloadIcon, ListVideoIcon, TriangleAlertIcon, type LucideIcon } from 'lucide-react';
import { Box } from '@/shared/components/layout/Box';
import { Stack } from '@/shared/components/layout/Stack';
import { Small, Span } from '@/shared/components/ui/typography';
import { cn } from '@/shared/lib/utils';
import { t } from '@/shared/lib/i18n';

export interface QueueCounts {
  active: number;
  waiting: number;
  done: number;
  errors: number;
}

interface StatBoxProps {
  icon: LucideIcon;
  toneClass: string;
  value: number;
  label: string;
}

const StatBox = ({ icon: Icon, toneClass, value, label }: StatBoxProps) => (
  <Stack
    direction="row"
    align="center"
    gap="none"
    className="min-w-[120px] flex-1 gap-2.75 rounded-[13px] border border-border bg-panel px-3.75 py-3.25"
  >
    <Span className={cn('flex size-9 flex-none items-center justify-center rounded-[10px]', toneClass)}>
      <Icon className="size-4.5" />
    </Span>
    <Box>
      <Box className="font-display text-xl leading-none font-bold">{value}</Box>
      <Small color="muted" className="mt-0.75 block text-[11.5px] font-normal">
        {label}
      </Small>
    </Box>
  </Stack>
);

/** Stat boxes row (Active / Waiting / Completed / Errors) — vanilla queue-view parity. */
export const QueueStats = ({ active, waiting, done, errors }: QueueCounts) => (
  <Stack direction="row" gap="none" wrap className="gap-3">
    <StatBox
      icon={DownloadIcon}
      toneClass="bg-primary-soft text-primary"
      value={active}
      label={t('Activas', 'Active')}
    />
    <StatBox
      icon={ListVideoIcon}
      toneClass="bg-info-soft text-info"
      value={waiting}
      label={t('En espera', 'Waiting')}
    />
    <StatBox
      icon={CheckIcon}
      toneClass="bg-success-soft text-success"
      value={done}
      label={t('Completadas', 'Completed')}
    />
    <StatBox
      icon={TriangleAlertIcon}
      toneClass="bg-destructive-soft text-destructive"
      value={errors}
      label={t('Errores', 'Errors')}
    />
  </Stack>
);
