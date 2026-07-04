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

interface LogoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending: boolean;
}

/** Sign-out confirmation (ports the vanilla showModal copy). */
export const LogoutDialog = ({ open, onOpenChange, onConfirm, isPending }: LogoutDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{t('Cerrar sesión', 'Sign out')}</DialogTitle>
        <DialogDescription className="whitespace-pre-line">
          {t(
            'Se borrarán las cookies guardadas en este equipo. Podrás volver a conectarte cuando quieras.\n\n¿Cerrar sesión de YouTube?',
            'The cookies stored on this device will be deleted. You can reconnect whenever you want.\n\nSign out of YouTube?',
          )}
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t('Cancelar', 'Cancel')}
        </Button>
        <Button variant="destructive" disabled={isPending} onClick={onConfirm}>
          {t('Cerrar sesión', 'Sign out')}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
