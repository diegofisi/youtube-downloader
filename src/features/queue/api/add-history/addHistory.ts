import { invoke } from '@/shared/lib/tauri';
import type { AddHistoryDTOResponse, AddHistoryMeta } from './add-history.dto';

/** Plain wrapper, not a RQ hook: store-driven, called from the queue scheduler. */
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
