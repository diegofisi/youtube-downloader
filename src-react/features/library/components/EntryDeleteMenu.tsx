import { useEffect, useState, type ReactNode } from 'react';
import { Trash2Icon, XIcon } from 'lucide-react';
import { Box } from '@/shared/components/layout/Box';
import { t } from '@/shared/lib/i18n';
import { cn } from '@/shared/lib/utils';

interface EntryDeleteMenuProps {
  hasFile: boolean;
  onRemove: () => void;
  onDeleteFile: () => void;
}

// Local dropdown (no @radix-ui/react-dropdown-menu in the project yet):
// trash button anchoring a small menu. Any click closes it — item handlers
// run first (React root listeners fire before this document-level one).
export const EntryDeleteMenu = ({ hasFile, onRemove, onDeleteFile }: EntryDeleteMenuProps) => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <Box className="relative">
      <button
        type="button"
        title={t('Quitar o eliminar', 'Remove or delete')}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex size-8 items-center justify-center rounded-lg border border-border text-destructive transition-colors hover:bg-accent"
        onClick={() => setOpen((v) => !v)}
      >
        <Trash2Icon className="size-4" />
      </button>
      {open && (
        <Box
          role="menu"
          className="absolute right-0 top-full z-30 mt-1 min-w-[190px] rounded-xl border border-border2 bg-popover p-1 shadow-stash"
        >
          <MenuItem
            icon={<XIcon className="size-4" />}
            label={t('Quitar de la lista', 'Remove from list')}
            onClick={onRemove}
          />
          {hasFile && (
            <MenuItem
              icon={<Trash2Icon className="size-4" />}
              label={t('Eliminar archivo', 'Delete file')}
              destructive
              onClick={onDeleteFile}
            />
          )}
        </Box>
      )}
    </Box>
  );
};

interface MenuItemProps {
  icon: ReactNode;
  label: string;
  destructive?: boolean;
  onClick: () => void;
}

const MenuItem = ({ icon, label, destructive = false, onClick }: MenuItemProps) => (
  <button
    type="button"
    role="menuitem"
    className={cn(
      'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12.5px] font-medium transition-colors hover:bg-accent',
      destructive ? 'text-destructive' : 'text-foreground',
    )}
    onClick={onClick}
  >
    {icon}
    {label}
  </button>
);
