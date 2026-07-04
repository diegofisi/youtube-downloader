import { invoke } from '@/shared/lib/tauri';

export function openHistoryFolder(folder: string): Promise<void> {
  return invoke<void>('open_history_folder', { folder });
}
