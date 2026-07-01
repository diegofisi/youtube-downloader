import { invoke } from '../../core/tauri/client';
import type { LibraryEntry } from './library.types';

export function getHistory(): Promise<LibraryEntry[]> {
  return invoke<LibraryEntry[]>('get_history');
}

export function addHistory(url: string, title: string, format: string): Promise<LibraryEntry> {
  return invoke<LibraryEntry>('add_history', { url, title, format });
}

export function removeHistoryItem(id: string): Promise<void> {
  return invoke('remove_history_item', { id });
}

export function clearHistory(): Promise<void> {
  return invoke('clear_history');
}

export function openHistoryFolder(folder: string): Promise<void> {
  return invoke('open_history_folder', { folder });
}
