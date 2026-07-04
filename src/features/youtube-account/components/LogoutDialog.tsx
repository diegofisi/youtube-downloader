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

interface LogoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending: boolean;
}

export const LogoutDialog = ({ open, onOpenChange, onConfirm, isPending }: LogoutDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{t.youtube.logout()}</DialogTitle>
        <DialogDescription className="whitespace-pre-line">
          {t.youtube.logoutConfirm()}
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t.common.cancel()}
        </Button>
        <Button variant="destructive" disabled={isPending} onClick={onConfirm}>
          {t.youtube.logout()}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
