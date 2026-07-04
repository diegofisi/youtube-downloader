import { AlertTriangleIcon, CheckIcon, ChevronRightIcon } from 'lucide-react';
import { Box } from '@/shared/components/layout/Box';
import { Stack } from '@/shared/components/layout/Stack';
import { Button } from '@/shared/components/ui/button';
import { Text } from '@/shared/components/ui/typography';
import { cn } from '@/shared/lib/utils';
import { t } from '@/shared/lib/messages/t';
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
  <Stack direction="row" align="center" justify="between" className="border-t border-border py-3.25">
    <Text variant="body-sm" className="font-mono">{name}</Text>
    <Text variant="caption"
      className={cn(
        'rounded-md px-2.25 py-0.75 font-bold',
        ok ? 'bg-success-soft text-success' : 'bg-destructive-soft text-destructive',
      )}
    >
      {ok ? t.settings.installed() : t.settings.missing()}
    </Text>
  </Stack>
);

export const TroubleshootingSection = ({
  status,
  repairing,
  progress,
  error,
  onRepair,
}: TroubleshootingSectionProps) => (
  <SettingsSection title={t.settings.troubleshoot()}>
    <Stack direction="row" gap="md" align="center" className="border-t border-border py-3.25">
      <Stack direction="row" gap="sm" align="center" className="min-w-0 flex-1 text-body-sm">
        {status === undefined && <Text variant="small" color="muted">…</Text>}
        {status?.ready === true && (
          <>
            <CheckIcon className="size-4 flex-none text-success" />
            <Text variant="small" className="font-normal text-foreground">
              {t.settings.allGood()}
            </Text>
          </>
        )}
        {status !== undefined && !status.ready && (
          <>
            <AlertTriangleIcon className="size-4 flex-none text-warn" />
            <Text variant="small" className="font-normal text-warn">
              {t.settings.missingComponents()}
            </Text>
          </>
        )}
      </Stack>
      <Button
        variant="outline"
        size="sm"
        className={cn('h-8.5', status !== undefined && !status.ready && 'border-warn text-warn')}
        disabled={repairing}
        onClick={onRepair}
      >
        {repairing ? t.settings.repairing() : t.settings.checkAndRepair()}
      </Button>
    </Stack>
    {repairing && progress !== null && (
      <Box className="pb-3.25">
        <Stack direction="row" gap="sm" justify="between" className="mb-1.5">
          <Text variant="small" color="muted" className="min-w-0 truncate font-normal">
            {progress.message}
          </Text>
          <Text variant="small" color="muted" className="flex-none font-mono">
            {Math.round(progress.percent)}%
          </Text>
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
      <Box className="pb-3.25">
        <Text variant="small" className="font-normal text-destructive">{`${t.common.error()}: ${error}`}</Text>
      </Box>
    )}
    <Box as="details" className="border-t border-border">
      <Box
        as="summary"
        className="flex cursor-pointer list-none items-center gap-1.75 rounded-md py-3.25 text-body-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ChevronRightIcon className="size-3.5 flex-none" />
        {t.settings.technicalDetails()}
      </Box>
      <Box className="pb-1">
        <DependencyRow name="yt-dlp" ok={status?.ytdlp === true} />
        <DependencyRow name="ffmpeg" ok={status?.ffmpeg === true} />
        <DependencyRow name="deno" ok={status?.deno === true} />
      </Box>
    </Box>
  </SettingsSection>
);
