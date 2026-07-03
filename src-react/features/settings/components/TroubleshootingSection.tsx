import { AlertTriangleIcon, CheckIcon, ChevronRightIcon } from 'lucide-react';
import { Box } from '@/shared/components/layout/Box';
import { Stack } from '@/shared/components/layout/Stack';
import { Button } from '@/shared/components/ui/button';
import { Small, Span } from '@/shared/components/ui/typography';
import { cn } from '@/shared/lib/utils';
import { t } from '@/shared/lib/i18n';
import type { DependencyStatus } from '../models/dependency-status.model';
import type { SetupProgress } from '../models/setup-progress.model';
import { SettingsSection } from './SettingsSection';

interface TroubleshootingSectionProps {
  status?: DependencyStatus;
  repairing: boolean;
  progress: SetupProgress | null;
  error: string | null;
  onRepair: () => void;
}

const DependencyRow = ({ name, ok }: { name: string; ok: boolean }) => (
  <Stack direction="row" align="center" justify="between" className="border-t border-border py-[13px]">
    <Span className="font-mono text-[13.5px]">{name}</Span>
    <Small
      className={cn(
        'rounded-md px-[9px] py-[3px] text-[11px] font-bold',
        ok ? 'bg-success-soft text-success' : 'bg-destructive-soft text-destructive',
      )}
    >
      {ok ? t('Instalado', 'Installed') : t('Falta', 'Missing')}
    </Small>
  </Stack>
);

export const TroubleshootingSection = ({ status, repairing, progress, error, onRepair }: TroubleshootingSectionProps) => (
  <SettingsSection title={t('Solucionar problemas', 'Troubleshooting')}>
    <Stack direction="row" gap="md" align="center" className="border-t border-border py-[13px]">
      <Stack direction="row" gap="sm" align="center" className="min-w-0 flex-1 text-[13.5px]">
        {status === undefined && <Small color="muted">…</Small>}
        {status?.ready === true && (
          <>
            <CheckIcon className="size-4 flex-none text-success" />
            <Small className="font-normal text-foreground">
              {t('Todo funciona correctamente', 'Everything is working correctly')}
            </Small>
          </>
        )}
        {status !== undefined && !status.ready && (
          <>
            <AlertTriangleIcon className="size-4 flex-none text-warn" />
            <Small className="font-normal text-warn">
              {t(
                'Faltan componentes necesarios — usa "Comprobar y reparar"',
                'Required components are missing — use "Check & repair"',
              )}
            </Small>
          </>
        )}
      </Stack>
      <Button
        variant="outline"
        size="sm"
        className={cn('h-[34px]', status !== undefined && !status.ready && 'border-warn text-warn')}
        disabled={repairing}
        onClick={onRepair}
      >
        {repairing ? t('Reparando…', 'Repairing…') : t('Comprobar y reparar', 'Check & repair')}
      </Button>
    </Stack>
    {repairing && progress !== null && (
      <Box className="pb-[13px]">
        <Stack direction="row" gap="sm" justify="between" className="mb-1.5">
          <Small color="muted" className="min-w-0 truncate font-normal">
            {progress.message}
          </Small>
          <Small color="muted" className="flex-none font-mono">
            {Math.round(progress.percent)}%
          </Small>
        </Stack>
        <Box className="h-1 rounded-sm bg-border">
          <Box
            className="h-full rounded-sm bg-primary transition-[width] duration-200"
            style={{ width: `${progress.percent}%` }}
          />
        </Box>
      </Box>
    )}
    {error !== null && (
      <Box className="pb-[13px]">
        <Small className="font-normal text-destructive">{`${t('Error', 'Error')}: ${error}`}</Small>
      </Box>
    )}
    <Box as="details" className="border-t border-border">
      <Box
        as="summary"
        className="flex cursor-pointer list-none items-center gap-[7px] rounded-md py-[13px] text-[13px] font-semibold text-muted-foreground hover:text-foreground"
      >
        <ChevronRightIcon className="size-3.5 flex-none" />
        {t('Detalles técnicos', 'Technical details')}
      </Box>
      <Box className="pb-1">
        <DependencyRow name="yt-dlp" ok={status?.ytdlp === true} />
        <DependencyRow name="ffmpeg" ok={status?.ffmpeg === true} />
        <DependencyRow name="deno" ok={status?.deno === true} />
      </Box>
    </Box>
  </SettingsSection>
);
