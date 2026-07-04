import { invoke } from '@/shared/lib/tauri';

export function getDownloadFolder(): Promise<string> {
  return invoke<string>('get_download_folder');
}
