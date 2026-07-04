/** Structural contract for media grid cards: any feature model with these fields fits. */
export interface MediaItem {
  url: string;
  title: string;
  channel: string;
  thumbnail?: string;
  duration?: number;
}

/** Fixed gradient behind (or instead of) thumbnails on media cards (ports CARD_GRAD). */
export const CARD_GRAD = 'linear-gradient(135deg,#3a2d6b,#c2456b)';

/** h:mm:ss / m:ss, empty when unknown (ports shared/lib/format fmtDuration). */
export function formatDuration(s?: number): string {
  if (!s) return '';
  const sec = Math.floor(s);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const ss = sec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(ss)}` : `${m}:${pad(ss)}`;
}
