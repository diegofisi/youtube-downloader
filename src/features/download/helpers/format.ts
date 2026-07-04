import { t } from '@/shared/lib/messages/t';

// Local ports of shared/lib/format.ts + gradients.ts: shared/ is outside this
// slice's write scope during the migration.
export function fmtDuration(s?: number): string {
  if (!s) return '';
  const sec = Math.floor(s);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const ss = sec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(ss)}` : `${m}:${pad(ss)}`;
}

export function fmtSize(mb: number): string {
  if (!mb) return '—';
  if (mb >= 1024) return `${(mb / 1024).toFixed(mb >= 10240 ? 0 : 1)} GB`;
  return `${Math.round(mb)} MB`;
}

export function timeAgo(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return t.download.justNow();
  const m = Math.floor(s / 60);
  if (m < 60) return t.download.minAgo({ m });
  const h = Math.floor(m / 60);
  if (h < 24) return t.download.hoursAgo({ h });
  return t.download.daysAgo({ d: Math.floor(h / 24) });
}

const GRADS = [
  'linear-gradient(135deg,#3a2d6b,#c2456b)',
  'linear-gradient(135deg,#1f6b52,#2b3b4d)',
  'linear-gradient(135deg,#6b1f4d,#3a2233)',
  'linear-gradient(135deg,#46307a,#a84a6b)',
  'linear-gradient(135deg,#1f4d6b,#33335a)',
];

export function gradFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffff;
  return GRADS[h % GRADS.length];
}
