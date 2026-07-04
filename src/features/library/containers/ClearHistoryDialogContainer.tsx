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
import { useClearHistory } from '../api/clear-history/useClearHistory';

interface ClearHistoryDialogContainerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ClearHistoryDialogContainer = ({ open, onOpenChange }: ClearHistoryDialogContainerProps) => {
  const { mutate: clearHistory, isPending } = useClearHistory();

  const onConfirm = () => {
    clearHistory(undefined, {
      onSuccess: () => {
        toast.info(t.library.clearedToast());
        onOpenChange(false);
      },
      onError: () => {
        toast.error(t.library.clearErrorToast());
        onOpenChange(false);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.library.clearTitle()}</DialogTitle>
          <DialogDescription>
            {t.library.clearConfirm()}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" disabled={isPending} onClick={() => onOpenChange(false)}>
            {t.common.cancel()}
          </Button>
          <Button disabled={isPending} onClick={onConfirm}>
            {t.library.clear()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
