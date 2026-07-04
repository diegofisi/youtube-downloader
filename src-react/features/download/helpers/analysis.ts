import { t } from '@/shared/lib/i18n';
import type { AnalyzedEntry, AnalyzedVideo, FlatVideo } from '../models/analyzed.model';

// Preview derivation helpers: flattening with duplicate marking and
// availability → status classification (ported from preview-render.ts).

export function flattenVideos(entries: AnalyzedEntry[]): FlatVideo[] {
  const out: FlatVideo[] = [];
  const seenIds = new Set<string>();
  for (const e of entries) {
    const vids = e.isPlaylist ? e.entries : [e];
    // Two passes per entry: dups are only marked across entries, like vanilla.
    for (const v of vids) out.push({ ...v, dup: seenIds.has(v.id) });
    for (const v of vids) seenIds.add(v.id);
  }
  return out;
}

export type VideoStatus = 'ok' | 'members' | 'downloaded' | 'private' | 'region' | 'error';

export function statusOf(v: AnalyzedVideo, downloaded: ReadonlySet<string>): VideoStatus {
  if (downloaded.has(v.id) || downloaded.has(v.url)) return 'downloaded';
  const a = v.availability;
  if (!a) return 'ok';
  if (a.startsWith('error')) return 'error';
  if (a === 'private') return 'private';
  if (a === 'subscriber_only' || a === 'premium_only' || a === 'needs_auth') return 'members';
  if (a.includes('region')) return 'region';
  return 'ok';
}

interface StatusMeta {
  label: () => string;
  /** Static Tailwind classes for the badge (text + soft background). */
  tone: string;
  downloadable: boolean;
}

export const STATUS_META: Record<VideoStatus, StatusMeta> = {
  ok: {
    label: () => t('Descargable', 'Downloadable'),
    tone: 'text-success bg-success/15',
    downloadable: true,
  },
  members: {
    label: () => t('De miembros · requiere sesión', 'Members-only · requires session'),
    tone: 'text-warn bg-warn/15',
    downloadable: true,
  },
  downloaded: {
    label: () => t('Ya descargado', 'Already downloaded'),
    tone: 'text-info bg-info/15',
    downloadable: true,
  },
  private: {
    label: () => t('Privado · no disponible', 'Private · not available'),
    tone: 'text-faint bg-faint/15',
    downloadable: false,
  },
  region: {
    label: () => t('Bloqueado por región', 'Region-blocked'),
    tone: 'text-warn bg-warn/15',
    downloadable: false,
  },
  error: {
    label: () => t('No disponible', 'Not available'),
    tone: 'text-destructive bg-destructive/15',
    downloadable: false,
  },
};

/** Duplicate cards reuse the badge slot with a faint tone. */
export const DUP_TONE = 'text-faint bg-faint/15';
export const dupLabel = (): string => t('Duplicado', 'Duplicate');
