import { useState } from 'react';
import { FolderOpenIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Stack } from '@/shared/components/layout/Stack';
import { Button } from '@/shared/components/ui/button';
import { Text } from '@/shared/components/ui/typography';
import { t } from '@/shared/lib/messages/t';
import { useOpenDownloadsFolder } from '../api/open-downloads-folder/useOpenDownloadsFolder';
import type { LibraryEntry } from '../models/library-entry.model';
import { LibraryListContainer } from '../containers/LibraryListContainer';
import { DeleteFileDialogContainer } from '../containers/DeleteFileDialogContainer';
import { ClearHistoryDialogContainer } from '../containers/ClearHistoryDialogContainer';

export const BibliotecaPage = () => {
  const [deleteEntry, setDeleteEntry] = useState<LibraryEntry | null>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const { mutate: openDownloads } = useOpenDownloadsFolder();

  const onOpenDownloads = () => {
    openDownloads(undefined, {
      onError: () => toast.error(t.common.couldNotOpenFolder()),
    });
  };

  return (
    <Stack gap="md" className="mx-auto w-full max-w-255 px-7.5 pt-6.5 pb-16">
      <Stack direction="row" align="end" justify="between" gap="md" className="mb-1">
        <Stack gap="xs">
          <Text variant="h1">{t.common.library()}</Text>
          <Text variant="body-sm" color="muted">
            {t.library.pageSubtitle()}
          </Text>
        </Stack>
        <Button
          variant="outline"
          className="h-9.5 flex-none rounded-[10px] px-3.75 text-body-sm"
          onClick={onOpenDownloads}
        >
          <FolderOpenIcon className="size-4" />
          {t.library.openDownloadsFolder()}
        </Button>
      </Stack>
      <LibraryListContainer onDeleteFile={setDeleteEntry} onClearAll={() => setClearOpen(true)} />
      <DeleteFileDialogContainer
        entry={deleteEntry}
        onOpenChange={(open) => {
          if (!open) setDeleteEntry(null);
        }}
      />
      <ClearHistoryDialogContainer open={clearOpen} onOpenChange={setClearOpen} />
    </Stack>
  );
};
