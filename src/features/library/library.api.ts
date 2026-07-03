import { invoke } from '../../core/tauri/client';
import type { LibraryEntry } from './library.types';

export function getHistory(): Promise<LibraryEntry[]> {
  return invoke<LibraryEntry[]>('get_history');
}

export interface AddHistoryMeta {
  videoId?: string;
  thumbnail?: string;
  /** Duración en segundos. */
  duration?: number;
  /** Ruta absoluta del archivo descargado. */
  filePath?: string;
}

export function addHistory(
  url: string,
  title: string,
  format: string,
  meta: AddHistoryMeta = {},
): Promise<LibraryEntry> {
  return invoke<LibraryEntry>('add_history', {
    url,
    title,
    format,
    videoId: meta.videoId ?? null,
    thumbnail: meta.thumbnail ?? null,
    duration: meta.duration ?? null,
    filePath: meta.filePath ?? null,
  });
}

export function removeHistoryItem(id: string): Promise<void> {
  return invoke('remove_history_item', { id });
}

/**
 * Borra el archivo de una entrada (papelera si es posible, permanente como
 * fallback) y elimina la entrada del historial.
 */
export function deleteHistoryFile(id: string): Promise<'trash' | 'permanent' | 'no_file'> {
  return invoke<'trash' | 'permanent' | 'no_file'>('delete_history_file', { id });
}

export function clearHistory(): Promise<void> {
  return invoke('clear_history');
}

export function openHistoryFolder(folder: string): Promise<void> {
  return invoke('open_history_folder', { folder });
}
