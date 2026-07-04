import { Stack } from '@/shared/components/layout/Stack';
import { Button } from '@/shared/components/ui/button';
import { PageEmpty } from '@/shared/components/ui/PageEmpty';
import { PageError } from '@/shared/components/ui/PageError';
import { PageLoading } from '@/shared/components/ui/PageLoading';
import { t } from '@/shared/lib/messages/t';
import type { LibraryEntry } from '../models/library-entry.model';
import type { UseLibraryList } from '../hooks/useLibraryList';
import { LibraryEntryRow } from './LibraryEntryRow';
import { LibraryToolbar } from './LibraryToolbar';

interface LibraryListProps {
  list: UseLibraryList;
  onDeleteFile: (entry: LibraryEntry) => void;
  onClearAll: () => void;
}

export const LibraryList = ({ list, onDeleteFile, onClearAll }: LibraryListProps) => (
  <Stack gap="md">
    <LibraryToolbar
      search={list.search}
      countText={list.countText}
      onSearchChange={list.onSearchChange}
      onClearAll={onClearAll}
    />
    {list.isLoading && <PageLoading message={t.library.loading()} />}
    {list.isError && <PageError message={t.library.loadError()} />}
    {list.entries !== undefined && list.shown.length === 0 && (
      <PageEmpty message={list.entries.length === 0 ? t.library.emptyTitle() : t.library.emptySearch()} />
    )}
    {list.shown.length > 0 && (
      <Stack gap="sm">
        {list.shown.map((entry) => (
          <LibraryEntryRow
            key={entry.id}
            entry={entry}
            onOpenFolder={() => list.onOpenFolder(entry)}
            onRemove={() => list.onRemove(entry)}
            onDeleteFile={() => onDeleteFile(entry)}
          />
        ))}
      </Stack>
    )}
    {list.hasMore && (
      <Stack direction="row" justify="center" className="mt-1">
        <Button variant="outline" className="h-9.5 rounded-[10px] px-5.5 text-body-sm" onClick={list.showMore}>
          {t.common.seeMore()}
        </Button>
      </Stack>
    )}
  </Stack>
);
