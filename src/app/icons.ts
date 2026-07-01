/** Registry de iconos SVG (line style, currentColor). */
const ICONS: Record<string, string> = {
  download: '<path d="M12 3v12m0 0 4-4m-4 4-4-4M5 18v1.5A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  queue: '<rect x="3" y="4" width="18" height="4" rx="1.5" stroke="currentColor" stroke-width="1.8"/><rect x="3" y="10" width="18" height="4" rx="1.5" stroke="currentColor" stroke-width="1.8"/><rect x="3" y="16" width="12" height="4" rx="1.5" stroke="currentColor" stroke-width="1.8"/>',
  youtube: '<path d="M22 12s0-3.2-.4-4.7a2.5 2.5 0 0 0-1.8-1.8C18.3 5 12 5 12 5s-6.3 0-7.8.5A2.5 2.5 0 0 0 2.4 7.3C2 8.8 2 12 2 12s0 3.2.4 4.7a2.5 2.5 0 0 0 1.8 1.8C5.7 19 12 19 12 19s6.3 0 7.8-.5a2.5 2.5 0 0 0 1.8-1.8C22 15.2 22 12 22 12Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="m10 9 5 3-5 3V9Z" fill="currentColor"/>',
  library: '<path d="M4 5v14m4-14v14M13 5.5l4.5 13M4 5h4M8 5h.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><rect x="3.5" y="5" width="5" height="14" rx="1" stroke="currentColor" stroke-width="1.8"/><path d="m12.5 6 4 13.5 3.5-1L16 5l-3.5 1Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
  settings: '<circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.8"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 0 1-4 0v-.1A1.6 1.6 0 0 0 6.6 19l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3 13.4H3a2 2 0 0 1 0-4h.1A1.6 1.6 0 0 0 4.6 6.6l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10 4.6V3a2 2 0 0 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
  bolt: '<path d="M13 2 4.5 13H11l-1 9 8.5-11H12l1-9Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
  sun: '<circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.8"/><path d="M12 2v2m0 16v2M4 12H2m20 0h-2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
  min: '<path d="M5 12h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  max: '<rect x="5.5" y="5.5" width="13" height="13" rx="2" stroke="currentColor" stroke-width="1.7"/>',
  close: '<path d="m6 6 12 12M18 6 6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
};

export function icon(name: keyof typeof ICONS | string, size = 18): string {
  const body = ICONS[name] ?? '';
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" aria-hidden="true">${body}</svg>`;
}
