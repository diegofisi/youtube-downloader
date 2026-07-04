import { invoke } from '@/shared/lib/tauri';

/** Opens the YouTube login window. Fire-and-forget: completion arrives as the
 * global 'cookies-extracted' event (see useCookiesExtractedSync). */
export function openYouTubeLogin(): Promise<void> {
  return invoke<void>('open_youtube_login');
}
