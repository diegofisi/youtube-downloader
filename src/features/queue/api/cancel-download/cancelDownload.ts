import { invoke } from '@/shared/lib/tauri';

/** Store-driven command (pause/cancel actions): plain invoke wrapper, NEVER a RQ hook.
 * `runId` targets one run (`<item>:<runSeq>`); omitted = every live run. */
export function cancelDownload(runId?: string): Promise<void> {
  return invoke<void>('cancel_download', { runId: runId ?? null });
}
