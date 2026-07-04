import { FolderIcon, PlayIcon } from 'lucide-react';
import { Box } from '@/shared/components/layout/Box';
import { Stack } from '@/shared/components/layout/Stack';
import { IconButton } from '@/shared/components/ui/IconButton';
import { Text } from '@/shared/components/ui/typography';
import { t } from '@/shared/lib/messages/t';
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
        <Text variant="micro" className="absolute bottom-0.75 right-0.75 rounded px-1 py-px font-mono font-semibold bg-black/80 text-white">
          {fmtDuration(entry.duration)}
        </Text>
      )}
    </Box>
    <Stack gap="none" className="min-w-0 flex-1">
      <Text variant="body-sm" className="truncate font-semibold leading-normal">{entry.title}</Text>
      <Text variant="small" color="muted" className="mt-0.5 text-xs font-normal leading-normal">
        {fmtDate(entry.date)}
      </Text>
      <Text variant="caption" className="mt-0.75 truncate font-mono font-normal leading-normal text-faint">
        {entry.folder}
      </Text>
    </Stack>
    <Box className="mr-1 flex-none text-right">
      <Text variant="caption" className="inline-flex items-center rounded-[7px] bg-primary-soft px-2 py-0.5 font-semibold text-primary">
        {entry.format}
      </Text>
    </Box>
    <Stack direction="row" align="center" gap="xs" className="flex-none">
      <IconButton title={t.common.openFolder()} onClick={onOpenFolder}>
        <FolderIcon className="size-4" />
      </IconButton>
      <EntryDeleteMenu hasFile={entry.filePath !== undefined} onRemove={onRemove} onDeleteFile={onDeleteFile} />
    </Stack>
  </Stack>
);
