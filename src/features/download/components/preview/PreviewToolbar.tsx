import { Stack } from '@/shared/components/layout/Stack';
import { Box } from '@/shared/components/layout/Box';
import { Text } from '@/shared/components/ui/typography';
import { t } from '@/shared/lib/messages/t';
import { cn } from '@/shared/lib/utils';

interface PreviewToolbarProps {
  hasEntries: boolean;
  totalCount: number;
  onlyDownloadable: boolean;
  allSelected: boolean;
  onToggleFilter: () => void;
  onToggleSelectAll: () => void;
}

export const PreviewToolbar = ({
  hasEntries,
  totalCount,
  onlyDownloadable,
  allSelected,
  onToggleFilter,
  onToggleSelectAll,
}: PreviewToolbarProps) => (
  <Stack direction="row" gap="sm" align="center" wrap className="gap-3">
    <Text variant="h6">{t.download.previewTitle()}</Text>
    {hasEntries && (
      /* "video(s)" reads the same in both languages */
      <Text variant="small" className="text-xs text-muted-foreground">{`${totalCount} video${totalCount === 1 ? '' : 's'}`}</Text>
    )}
    <Box className="flex-1" />
    {hasEntries && (
      <>
        <button
          type="button"
          onClick={onToggleFilter}
          className={cn(
            'rounded-lg border-[1.5px] px-2.75 py-1.5 text-xs font-semibold transition-colors',
            onlyDownloadable
              ? 'border-primary bg-primary-soft text-primary'
              : 'border-border bg-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          {t.download.onlyDownloadable()}
        </button>
        <button
          type="button"
          onClick={onToggleSelectAll}
          className="rounded-lg px-2 py-1.5 text-small font-medium text-primary transition-colors hover:bg-primary-soft"
        >
          {allSelected ? t.download.clearSelection() : t.download.selectAll()}
        </button>
      </>
    )}
  </Stack>
);
