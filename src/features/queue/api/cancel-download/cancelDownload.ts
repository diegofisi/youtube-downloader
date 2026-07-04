import { invoke } from '@/shared/lib/tauri';

/** Store-driven command (pause/cancel actions): plain invoke wrapper, NEVER a RQ hook. */
export function cancelDownload(url?: string): Promise<void> {
  return invoke<void>('cancel_download', { url: url ?? null });
}
