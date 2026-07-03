import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '../../core/tauri/client';
import type { AppConfig } from './settings.types';

export function getSettings(): Promise<AppConfig> {
  return invoke<AppConfig>('get_settings');
}

/** Full set of persistent settings (set_settings command). */
export interface SettingsUpdate {
  defaultQuality: string;
  defaultContainer: string;
  defaultAudioFormat: string;
  defaultConcurrency: number;
  /** "video" | "audio" */
  defaultMode: string;
  /** Output template (without ".%(ext)s"). */
  defaultTemplate: string;
  defaultSubtitles: boolean;
  defaultThumbnail: boolean;
  clearLinksAfterPreview: boolean;
}

export function setSettings(update: SettingsUpdate): Promise<void> {
  return invoke('set_settings', { ...update });
}

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
