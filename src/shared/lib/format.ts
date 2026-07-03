import { t, getLang } from '../../core/i18n';

/** "h:mm:ss" or "m:ss" duration from seconds. */
export function fmtDuration(s?: number): string {
  if (!s) return '';
  const sec = Math.floor(s);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const ss = sec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(ss)}` : `${m}:${pad(ss)}`;
}

/** Human-readable size from megabytes ("—" if 0). */
export function fmtSize(mb: number): string {
  if (!mb) return '—';
  if (mb >= 1024) return `${(mb / 1024).toFixed(mb >= 10240 ? 0 : 1)} GB`;
  return `${Math.round(mb)} MB`;
}

/** Relative time ("X min/h/d ago") from a ms timestamp. */
export function timeAgo(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return t('ahora', 'now');
  const m = Math.floor(s / 60);
  if (m < 60) return t(`hace ${m} min`, `${m} min ago`);
  const h = Math.floor(m / 60);
  if (h < 24) return t(`hace ${h} h`, `${h} h ago`);
  return t(`hace ${Math.floor(h / 24)} d`, `${Math.floor(h / 24)} d ago`);
}

/** Short local date (day, month, hour:min) per active language; unix seconds. */
export function fmtDate(secs: number): string {
  try {
    return new Date(secs * 1000).toLocaleString(getLang(), {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}
