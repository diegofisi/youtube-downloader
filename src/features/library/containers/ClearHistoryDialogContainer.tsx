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
import { useClearHistory } from '../api/clear-history/useClearHistory';

interface ClearHistoryDialogContainerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Leaf container: confirm dialog + clear_history mutation. Files are NOT deleted. */
export const ClearHistoryDialogContainer = ({ open, onOpenChange }: ClearHistoryDialogContainerProps) => {
  const { mutate: clearHistory, isPending } = useClearHistory();

  const onConfirm = () => {
    clearHistory(undefined, {
      onSuccess: () => {
        toast.info(t('Historial vaciado', 'History cleared'));
        onOpenChange(false);
      },
      onError: () => {
        toast.error(t('No se pudo vaciar el historial', 'Could not clear the history'));
        onOpenChange(false);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('Vaciar historial', 'Clear history')}</DialogTitle>
          <DialogDescription>
            {t(
              'Se limpiará el historial de descargas. Los archivos descargados NO se borran de tu equipo.',
              'This will clear your download history. The downloaded files will NOT be deleted from your computer.',
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" disabled={isPending} onClick={() => onOpenChange(false)}>
            {t('Cancelar', 'Cancel')}
          </Button>
          <Button disabled={isPending} onClick={onConfirm}>
            {t('Vaciar', 'Clear')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
