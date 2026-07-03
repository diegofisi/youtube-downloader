/** Información de la cuenta de YouTube conectada (comando get_account_info). */
export interface AccountInfo {
  name: string;
  handle: string | null;
  avatarUrl: string | null;
}

export interface CookieResult {
  status: 'none' | 'youtube' | 'generic' | 'invalid' | 'error' | 'cancelled';
  path?: string;
  message?: string;
}

export const EXTENSION_URLS: Record<string, string> = {
  chrome:
    'https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc',
  edge: 'https://microsoftedge.microsoft.com/addons/detail/get-cookiestxt-locally/onhelfinnpnkfepphbhcogebjfmmhfjm',
  firefox: 'https://addons.mozilla.org/es/firefox/addon/cookies-txt/',
};
