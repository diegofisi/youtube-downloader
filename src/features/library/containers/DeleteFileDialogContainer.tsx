import { toast } from 'sonner';
import { Button } from '@/shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { t } from '@/shared/lib/messages/t';
import { useDeleteHistoryFile } from '../api/delete-history-file/useDeleteHistoryFile';
import { DeleteFileOutcome } from '../models/delete-file-outcome.model';
import type { LibraryEntry } from '../models/library-entry.model';

interface DeleteFileDialogContainerProps {
  entry: LibraryEntry | null;
  onOpenChange: (open: boolean) => void;
}

export const DeleteFileDialogContainer = ({ entry, onOpenChange }: DeleteFileDialogContainerProps) => {
  const { mutate: deleteFile, isPending } = useDeleteHistoryFile();

  const onConfirm = () => {
    if (entry === null) return;
    deleteFile(
      { id: entry.id },
      {
        onSuccess: (outcome) => {
          if (outcome === DeleteFileOutcome.Trash)
            toast.success(t.library.fileTrashedToast());
          if (outcome === DeleteFileOutcome.Permanent)
            toast.warning(
              t.library.fileDeletedToast(),
            );
          if (outcome === DeleteFileOutcome.NoFile)
            toast.info(
              t.library.fileGoneToast(),
            );
          onOpenChange(false);
        },
        onError: () => {
          toast.error(t.library.deleteFileErrorToast());
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog open={entry !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.library.deleteFile()}</DialogTitle>
          <DialogDescription>
            {t.library.deleteFileConfirm()}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" disabled={isPending} onClick={() => onOpenChange(false)}>
            {t.common.cancel()}
          </Button>
          <Button variant="destructive" disabled={isPending} onClick={onConfirm}>
            {t.library.delete()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
