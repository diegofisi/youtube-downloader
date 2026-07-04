import { FolderIcon, PlayIcon } from 'lucide-react';
import { Box } from '@/shared/components/layout/Box';
import { Stack } from '@/shared/components/layout/Stack';
import { Small, Span } from '@/shared/components/ui/typography';
import { t } from '@/shared/lib/i18n';
import type { LibraryEntry } from '../models/library-entry.model';
import { fmtDate, fmtDuration } from '../helpers/format';
import { gradFor } from '../helpers/gradients';
import { EntryDeleteMenu } from './EntryDeleteMenu';

interface LibraryEntryRowProps {
  entry: LibraryEntry;
  onOpenFolder: () => void;
  onRemove: () => void;
  onDeleteFile: () => void;
}

export const LibraryEntryRow = ({ entry, onOpenFolder, onRemove, onDeleteFile }: LibraryEntryRowProps) => (
  <Stack
    direction="row"
    align="center"
    gap="none"
    className="gap-3.25 rounded-[13px] border border-border bg-panel p-2.75"
  >
    <Box
      className="relative h-13 w-23 flex-none overflow-hidden rounded-lg"
      style={{ background: gradFor(entry.id) }}
    >
      {entry.thumbnail !== undefined && (
        <img src={entry.thumbnail} loading="lazy" alt="" className="size-full object-cover" />
      )}
      {entry.thumbnail === undefined && (
        <Box className="absolute inset-0 flex items-center justify-center text-white/90">
          <PlayIcon className="size-5" />
        </Box>
      )}
      {entry.duration !== undefined && (
        <Span className="absolute bottom-0.75 right-0.75 rounded px-1 py-px font-mono text-[9.5px] font-semibold bg-black/80 text-white">
          {fmtDuration(entry.duration)}
        </Span>
      )}
    </Box>
    <Stack gap="none" className="min-w-0 flex-1">
      <Small className="truncate text-[13.5px] font-semibold leading-normal">{entry.title}</Small>
      <Small color="muted" className="mt-0.5 text-xs font-normal leading-normal">
        {fmtDate(entry.date)}
      </Small>
      <Small className="mt-0.75 truncate font-mono text-[11px] font-normal leading-normal text-faint">
        {entry.folder}
      </Small>
    </Stack>
    <Box className="mr-1 flex-none text-right">
      <Span className="inline-flex items-center rounded-[7px] bg-primary-soft px-2 py-0.5 text-[11px] font-semibold text-primary">
        {entry.format}
      </Span>
    </Box>
    <Stack direction="row" align="center" gap="xs" className="flex-none">
      <button
        type="button"
        title={t('Abrir carpeta', 'Open folder')}
        className="flex size-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        onClick={onOpenFolder}
      >
        <FolderIcon className="size-4" />
      </button>
      <EntryDeleteMenu hasFile={entry.filePath !== undefined} onRemove={onRemove} onDeleteFile={onDeleteFile} />
    </Stack>
  </Stack>
);
