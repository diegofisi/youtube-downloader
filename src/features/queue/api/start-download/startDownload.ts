import { invoke } from '@/shared/lib/tauri';
import type { DownloadOptions } from '../../models/download-options.model';
import type { DownloadResultDTOResponse } from './start-download.dto';

/** Store-driven command (decision table): plain invoke wrapper, NEVER a RQ hook. */
export function startDownload(url: string, options: DownloadOptions): Promise<DownloadResultDTOResponse> {
  return invoke<DownloadResultDTOResponse>('start_download', { url, options });
}
