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
import { t } from '@/shared/lib/i18n';
import { useDeleteHistoryFile } from '../api/delete-history-file/useDeleteHistoryFile';
import { DeleteFileOutcome } from '../models/delete-file-outcome.model';
import type { LibraryEntry } from '../models/library-entry.model';

interface DeleteFileDialogContainerProps {
  entry: LibraryEntry | null;
  onOpenChange: (open: boolean) => void;
}

/** Leaf container: confirm dialog + delete_history_file mutation with outcome toasts. */
export const DeleteFileDialogContainer = ({ entry, onOpenChange }: DeleteFileDialogContainerProps) => {
  const { mutate: deleteFile, isPending } = useDeleteHistoryFile();

  const onConfirm = () => {
    if (entry === null) return;
    deleteFile(
      { id: entry.id },
      {
        onSuccess: (outcome) => {
          if (outcome === DeleteFileOutcome.Trash)
            toast.success(t('Archivo enviado a la papelera', 'File moved to Recycle Bin'));
          if (outcome === DeleteFileOutcome.Permanent)
            toast.warning(
              t(
                'Archivo eliminado permanentemente (la unidad no tiene papelera)',
                'File permanently deleted (the drive has no Recycle Bin)',
              ),
            );
          if (outcome === DeleteFileOutcome.NoFile)
            toast.info(
              t(
                'El archivo ya no existía; se quitó de la lista',
                'The file no longer existed; it was removed from the list',
              ),
            );
          onOpenChange(false);
        },
        onError: () => {
          toast.error(t('No se pudo eliminar el archivo', 'Could not delete the file'));
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog open={entry !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('Eliminar archivo', 'Delete file')}</DialogTitle>
          <DialogDescription>
            {t(
              'Se enviará a la papelera si es posible; si no, se eliminará permanentemente.',
              'The file will be moved to the Recycle Bin if possible; otherwise it will be permanently deleted.',
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" disabled={isPending} onClick={() => onOpenChange(false)}>
            {t('Cancelar', 'Cancel')}
          </Button>
          <Button variant="destructive" disabled={isPending} onClick={onConfirm}>
            {t('Eliminar', 'Delete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
