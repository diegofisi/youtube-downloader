import { useState } from 'react';
import { FolderOpenIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Stack } from '@/shared/components/layout/Stack';
import { Button } from '@/shared/components/ui/button';
import { H1, P } from '@/shared/components/ui/typography';
import { t } from '@/shared/lib/i18n';
import { useOpenDownloadsFolder } from '../api/open-downloads-folder/useOpenDownloadsFolder';
import type { LibraryEntry } from '../models/library-entry.model';
import { LibraryListContainer } from '../containers/LibraryListContainer';
import { DeleteFileDialogContainer } from '../containers/DeleteFileDialogContainer';
import { ClearHistoryDialogContainer } from '../containers/ClearHistoryDialogContainer';

// Pattern B (page orchestrates): the list container + two confirm-dialog leaves.
// The page only owns which dialog is open and for which entry.
export const BibliotecaPage = () => {
  const [deleteEntry, setDeleteEntry] = useState<LibraryEntry | null>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const { mutate: openDownloads } = useOpenDownloadsFolder();

  const onOpenDownloads = () => {
    openDownloads(undefined, {
      onError: () => toast.error(t('No se pudo abrir la carpeta', 'Could not open the folder')),
    });
  };

  return (
    <Stack gap="md" className="mx-auto w-full max-w-255 px-7.5 pt-6.5 pb-16">
      <Stack direction="row" align="end" justify="between" gap="md" className="mb-1">
        <Stack gap="xs">
          <H1>{t('Biblioteca', 'Library')}</H1>
          <P color="muted" className="text-[13.5px]">
            {t('Todo lo que has descargado, en un solo lugar.', "Everything you've downloaded, in one place.")}
          </P>
        </Stack>
        <Button
          variant="outline"
          className="h-9.5 flex-none rounded-[10px] px-3.75 text-[13px]"
          onClick={onOpenDownloads}
        >
          <FolderOpenIcon className="size-4" />
          {t('Abrir carpeta de descargas', 'Open downloads folder')}
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
