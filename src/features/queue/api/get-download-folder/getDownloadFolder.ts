import { invoke } from '@/shared/lib/tauri';

/** Fallback folder for the queue's "open folder" action (bare string — no DTO). */
export function getDownloadFolder(): Promise<string> {
  return invoke<string>('get_download_folder');
}
