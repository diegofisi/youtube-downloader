import type { LibraryEntry } from '../models/library-entry.model';
import { useLibraryList } from '../hooks/useLibraryList';
import { LibraryList } from '../components/LibraryList';

interface LibraryListContainerProps {
  onDeleteFile: (entry: LibraryEntry) => void;
  onClearAll: () => void;
}

export const LibraryListContainer = ({ onDeleteFile, onClearAll }: LibraryListContainerProps) => {
  const list = useLibraryList();
  return <LibraryList list={list} onDeleteFile={onDeleteFile} onClearAll={onClearAll} />;
};
