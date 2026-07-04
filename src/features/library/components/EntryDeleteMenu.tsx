import { useEffect, useState, type ReactNode } from 'react';
import { Trash2Icon, XIcon } from 'lucide-react';
import { Box } from '@/shared/components/layout/Box';
import { IconButton } from '@/shared/components/ui/IconButton';
import { t } from '@/shared/lib/messages/t';
import { cn } from '@/shared/lib/utils';

interface EntryDeleteMenuProps {
  hasFile: boolean;
  onRemove: () => void;
  onDeleteFile: () => void;
}

// No dropdown-menu dep yet, so hand-rolled. Any document click closes it, but item
// handlers still fire first: React root listeners run before this document-level one.
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
      <IconButton
        title={t.library.removeOrDelete()}
        aria-haspopup="menu"
        aria-expanded={open}
        tone="danger"
        onClick={() => setOpen((v) => !v)}
      >
        <Trash2Icon className="size-4" />
      </IconButton>
      {open && (
        <Box
          role="menu"
          className="absolute right-0 top-full z-30 mt-1 min-w-47.5 rounded-xl border border-border2 bg-popover p-1 shadow-stash"
        >
          <MenuItem
            icon={<XIcon className="size-4" />}
            label={t.common.removeFromList()}
            onClick={onRemove}
          />
          {hasFile && (
            <MenuItem
              icon={<Trash2Icon className="size-4" />}
              label={t.library.deleteFile()}
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
      'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-small font-medium transition-colors hover:bg-accent',
      destructive ? 'text-destructive' : 'text-foreground',
    )}
    onClick={onClick}
  >
    {icon}
    {label}
  </button>
);
