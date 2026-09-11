import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { t } from '@/shared/lib/messages/t';
import { useGetHistory } from '../api/get-history/useGetHistory';
import { useOpenHistoryFolder } from '../api/open-history-folder/useOpenHistoryFolder';
import { useRemoveHistoryItem } from '../api/remove-history-item/useRemoveHistoryItem';
import type { LibraryEntry } from '../models/library-entry.model';

const PAGE_SIZE = 50;

export function useLibraryList() {
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
    ? t.library.showingCount({ shown: shown.length, total: filtered.length })
    : t.library.itemCount({ n: filtered.length });

  const onSearchChange = (value: string) => {
    setSearch(value);
    setVisibleCount(PAGE_SIZE); // new filter restarts pagination (mirrors vanilla)
  };
  const showMore = () => setVisibleCount((c) => c + PAGE_SIZE);

  const onRemove = (entry: LibraryEntry) =>
    removeItem({ id: entry.id }, { onError: () => toast.error(t.library.removeErrorToast()) });
  // Templates may add subfolders: the file's own directory beats the download root.
  const onOpenFolder = (entry: LibraryEntry) => {
    const sep = Math.max(entry.filePath?.lastIndexOf('\\') ?? -1, entry.filePath?.lastIndexOf('/') ?? -1);
    const parent = entry.filePath && sep >= 0 ? entry.filePath.slice(0, sep) || '/' : entry.folder;
    // "D:" alone is drive-relative for explorer; the root needs its separator.
    const folder = /^[A-Za-z]:$/.test(parent) ? `${parent}\\` : parent;
    openFolder({ folder }, { onError: () => toast.error(t.common.couldNotOpenFolder()) });
  };

  return { entries, isLoading, isError, search, shown, hasMore, countText, onSearchChange, showMore, onRemove, onOpenFolder };
}

export type UseLibraryList = ReturnType<typeof useLibraryList>;
