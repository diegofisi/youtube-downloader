import { invoke } from '@/shared/lib/tauri';

/** OS side-effect (open the containing folder) — no cache involved. */
export function openHistoryFolder(folder: string): Promise<void> {
  return invoke<void>('open_history_folder', { folder });
}
