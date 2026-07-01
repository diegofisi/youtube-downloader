import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '../../core/tauri/client';

export async function openDownloadsFolder(): Promise<void> {
  return invoke('open_downloads_folder');
}

export async function getDownloadFolder(): Promise<string> {
  return invoke<string>('get_download_folder');
}

export async function changeDownloadFolder(): Promise<string | null> {
  const selected = await open({
    title: 'Selecciona la carpeta de descargas',
    directory: true,
  });

  if (!selected) return null;

  const folderPath = typeof selected === 'string' ? selected : (selected as { path: string }).path;
  return invoke<string>('set_download_folder', { folder: folderPath });
}
