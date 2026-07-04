import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Stack } from '@/shared/components/layout/Stack';
import { Button } from '@/shared/components/ui/button';
import { PageEmpty } from '@/shared/components/ui/PageEmpty';
import { PageError } from '@/shared/components/ui/PageError';
import { PageLoading } from '@/shared/components/ui/PageLoading';
import { t } from '@/shared/lib/i18n';
import { useGetHistory } from '../api/get-history/useGetHistory';
import { useOpenHistoryFolder } from '../api/open-history-folder/useOpenHistoryFolder';
import { useRemoveHistoryItem } from '../api/remove-history-item/useRemoveHistoryItem';
import type { LibraryEntry } from '../models/library-entry.model';
import { LibraryEntryRow } from '../components/LibraryEntryRow';
import { LibraryToolbar } from '../components/LibraryToolbar';

const PAGE_SIZE = 50;

interface LibraryListContainerProps {
  onDeleteFile: (entry: LibraryEntry) => void;
  onClearAll: () => void;
}

export const LibraryListContainer = ({ onDeleteFile, onClearAll }: LibraryListContainerProps) => {
  const { data: entries, isLoading, isError } = useGetHistory();
  const { mutate: removeItem } = useRemoveHistoryItem();
  const { mutate: openFolder } = useOpenHistoryFolder();
  const [search, setSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q === '' || entries === undefined) return entries ?? [];
    return entries.filter((e) => e.title.toLowerCase().includes(q) || e.url.toLowerCase().includes(q));
  }, [entries, search]);

  const shown = filtered.slice(0, visibleCount);
  const hasMore = filtered.length > shown.length;
  const countText = hasMore
    ? t(`${shown.length} de ${filtered.length} elementos`, `${shown.length} of ${filtered.length} items`)
    : t(
        `${filtered.length} elemento${filtered.length === 1 ? '' : 's'}`,
        `${filtered.length} item${filtered.length === 1 ? '' : 's'}`,
      );

  const onSearchChange = (value: string) => {
    setSearch(value);
    setVisibleCount(PAGE_SIZE); // new filter restarts pagination (mirrors vanilla)
  };

  const onRemove = (entry: LibraryEntry) => {
    removeItem(
      { id: entry.id },
      {
        onError: () => toast.error(t('No se pudo quitar del historial', 'Could not remove from history')),
      },
    );
  };

  const onOpenFolder = (entry: LibraryEntry) => {
    openFolder(
      { folder: entry.folder },
      {
        onError: () => toast.error(t('No se pudo abrir la carpeta', 'Could not open the folder')),
      },
    );
  };

  return (
    <Stack gap="md">
      <LibraryToolbar
        search={search}
        countText={countText}
        onSearchChange={onSearchChange}
        onClearAll={onClearAll}
      />
      {isLoading && <PageLoading message={t('Cargando biblioteca...', 'Loading library...')} />}
      {isError && <PageError message={t('No se pudo cargar la biblioteca.', 'Failed to load the library.')} />}
      {entries !== undefined && filtered.length === 0 && (
        <PageEmpty
          message={
            entries.length === 0
              ? t('Sin descargas todavía. Lo que descargues aparecerá aquí.', 'No downloads yet. Your downloads will show up here.')
              : t('Sin resultados para tu búsqueda.', 'No results for your search.')
          }
        />
      )}
      {shown.length > 0 && (
        <Stack gap="sm">
          {shown.map((entry) => (
            <LibraryEntryRow
              key={entry.id}
              entry={entry}
              onOpenFolder={() => onOpenFolder(entry)}
              onRemove={() => onRemove(entry)}
              onDeleteFile={() => onDeleteFile(entry)}
            />
          ))}
        </Stack>
      )}
      {hasMore && (
        <Stack direction="row" justify="center" className="mt-1">
          <Button
            variant="outline"
            className="h-[38px] rounded-[10px] px-[22px] text-[13px]"
            onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
          >
            {t('Ver más', 'Show more')}
          </Button>
        </Stack>
      )}
    </Stack>
  );
};
