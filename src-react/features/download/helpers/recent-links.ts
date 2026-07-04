// Recent links history — same localStorage key/format as the vanilla app so
// both apps share history during the migration.

const RECENT_KEY = 'stash.recentLinks';

export interface RecentLink {
  url: string;
  ts: number;
}

export function loadRecents(): RecentLink[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    if (Array.isArray(raw))
      return (raw as RecentLink[]).filter((r) => r && typeof r.url === 'string' && typeof r.ts === 'number');
  } catch {
    /* corrupt data: ignored */
  }
  return [];
}

export function addRecentLinks(urls: string[]): void {
  const now = Date.now();
  const merged = [...urls.map((u) => ({ url: u, ts: now })), ...loadRecents()];
  const seen = new Set<string>();
  const out = merged.filter((r) => !seen.has(r.url) && !!seen.add(r.url)).slice(0, 50);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(out));
  } catch {
    /* out of space: not critical */
  }
}

export function clearRecents(): void {
  try {
    localStorage.removeItem(RECENT_KEY);
  } catch {
    /* ignore */
  }
}
