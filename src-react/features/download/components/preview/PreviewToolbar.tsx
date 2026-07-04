import { Stack } from '@/shared/components/layout/Stack';
import { Box } from '@/shared/components/layout/Box';
import { H3, Small } from '@/shared/components/ui/typography';
import { t } from '@/shared/lib/i18n';
import { cn } from '@/shared/lib/utils';

interface PreviewToolbarProps {
  hasEntries: boolean;
  totalCount: number;
  onlyDownloadable: boolean;
  allSelected: boolean;
  onToggleFilter: () => void;
  onToggleSelectAll: () => void;
}

/** "Vista previa" heading + count + filter/select-all actions (visible with a batch). */
export const PreviewToolbar = ({
  hasEntries,
  totalCount,
  onlyDownloadable,
  allSelected,
  onToggleFilter,
  onToggleSelectAll,
}: PreviewToolbarProps) => (
  <Stack direction="row" gap="sm" align="center" wrap className="gap-3">
    <H3 className="text-[15px]">{t('Vista previa', 'Preview')}</H3>
    {hasEntries && (
      /* "video(s)" reads the same in both languages */
      <Small className="text-xs text-muted-foreground">{`${totalCount} video${totalCount === 1 ? '' : 's'}`}</Small>
    )}
    <Box className="flex-1" />
    {hasEntries && (
      <>
        <button
          type="button"
          onClick={onToggleFilter}
          className={cn(
            'rounded-lg border-[1.5px] px-[11px] py-[6px] text-xs font-semibold transition-colors',
            onlyDownloadable
              ? 'border-primary bg-primary-soft text-primary'
              : 'border-border bg-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          {t('Solo descargables', 'Downloadable only')}
        </button>
        <button
          type="button"
          onClick={onToggleSelectAll}
          className="rounded-lg px-2 py-[6px] text-[12.5px] font-medium text-primary transition-colors hover:bg-primary-soft"
        >
          {allSelected ? t('Quitar selección', 'Clear selection') : t('Seleccionar todo', 'Select all')}
        </button>
      </>
    )}
  </Stack>
);
