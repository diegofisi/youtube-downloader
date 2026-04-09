export interface CookieResult {
  status: 'none' | 'youtube' | 'generic' | 'invalid' | 'error' | 'cancelled';
  path?: string;
  message?: string;
}

export interface DownloadResult {
  success: boolean;
  error?: string;
}

export interface ProgressData {
  percent: number;
  speed: string;
  eta: string;
  status: 'downloading' | 'processing' | 'finished' | 'error';
  url: string;
}

export interface DependencyStatus {
  ytdlp: boolean;
  ffmpeg: boolean;
  deno: boolean;
  ready: boolean;
}

export interface SetupProgress {
  step: string;
  percent: number;
  message: string;
}

export const EXTENSION_URLS: Record<string, string> = {
  chrome: 'https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc',
  edge: 'https://microsoftedge.microsoft.com/addons/detail/get-cookiestxt-locally/onhelfinnpnkfepphbhcogebjfmmhfjm',
  firefox: 'https://addons.mozilla.org/es/firefox/addon/cookies-txt/',
};
