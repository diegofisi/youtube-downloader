import { invoke } from '@/shared/lib/tauri';
import type { AddHistoryDTOResponse, AddHistoryMeta } from './add-history.dto';

/** Called by the queue store on item completion (decision table: mutation-shaped
 * but store-driven). Meta keys are passed exactly like the vanilla library.api. */
export function addHistory(
  url: string,
  title: string,
  format: string,
  meta: AddHistoryMeta = {},
): Promise<AddHistoryDTOResponse> {
  return invoke<AddHistoryDTOResponse>('add_history', {
    url,
    title,
    format,
    videoId: meta.videoId ?? null,
    thumbnail: meta.thumbnail ?? null,
    duration: meta.duration ?? null,
    filePath: meta.filePath ?? null,
  });
}
