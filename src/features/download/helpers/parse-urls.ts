import { t } from '@/shared/lib/messages/t';

// Keeps lines that look like links (vanilla rule: startsWith http).
export function parseUrls(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('http'));
}

export function countLines(text: string): number {
  return text.split('\n').filter((l) => l.trim()).length;
}

export function lineCountLabel(n: number): string {
  return t.download.lineCount({ n });
}

export function mergeLines(text: string, urls: string[]): string {
  const existing = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const known = new Set(existing);
  const added = urls.map((u) => u.trim()).filter((u) => u && !known.has(u) && known.add(u));
  return [...existing, ...added].join('\n');
}
