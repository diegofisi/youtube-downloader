import { useEffect, useRef, useState } from 'react';
import { DownloadIcon, SlidersHorizontalIcon } from 'lucide-react';
import { t } from '@/shared/lib/messages/t';
import { cn } from '@/shared/lib/utils';

const ITEM_CLASS =
  'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-small font-semibold text-foreground transition-colors hover:bg-accent';

interface DownloadMenuProps {
  onDownload: () => void;
  onCustomize: () => void;
  className?: string;
}

// Hand-rolled dropdown: @radix-ui/react-dropdown-menu is not in the dependency set.
export const DownloadMenu = ({ onDownload, onCustomize, className }: DownloadMenuProps) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const pick = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <span ref={rootRef} className={cn('relative block', className)}>
      <button
        type="button"
        title={t.common.download()}
        onClick={() => setOpen((v) => !v)}
        className="flex size-7.5 items-center justify-center rounded-lg bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-black/75"
      >
        <DownloadIcon className="size-4" />
      </button>
      {open && (
        <span className="absolute top-8.5 right-0 z-30 flex w-56 flex-col rounded-xl border border-border2 bg-popover p-1 shadow-stash">
          <button
            type="button"
            onClick={() => pick(onDownload)}
            className={ITEM_CLASS}
          >
            <DownloadIcon className="size-4 text-muted-foreground" />
            {t.common.download()}
          </button>
          <button
            type="button"
            onClick={() => pick(onCustomize)}
            className={ITEM_CLASS}
          >
            <SlidersHorizontalIcon className="size-4 text-muted-foreground" />
            {t.shell.customDownload()}
          </button>
        </span>
      )}
    </span>
  );
};
