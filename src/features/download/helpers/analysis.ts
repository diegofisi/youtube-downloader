import { t } from '@/shared/lib/messages/t';
import type { AnalyzedEntry, AnalyzedVideo, FlatVideo } from '../models/analyzed.model';

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
  tone: string;
  downloadable: boolean;
}

export const STATUS_META: Record<VideoStatus, StatusMeta> = {
  ok: {
    label: () => t.download.statusDownloadable(),
    tone: 'text-success bg-success/15',
    downloadable: true,
  },
  members: {
    label: () => t.download.statusMembers(),
    tone: 'text-warn bg-warn/15',
    downloadable: true,
  },
  downloaded: {
    label: () => t.download.statusAlreadyDownloaded(),
    tone: 'text-info bg-info/15',
    downloadable: true,
  },
  private: {
    label: () => t.download.statusPrivate(),
    tone: 'text-faint bg-faint/15',
    downloadable: false,
  },
  region: {
    label: () => t.download.statusRegionBlocked(),
    tone: 'text-warn bg-warn/15',
    downloadable: false,
  },
  error: {
    label: () => t.download.statusUnavailable(),
    tone: 'text-destructive bg-destructive/15',
    downloadable: false,
  },
};

export const DUP_TONE = 'text-faint bg-faint/15';
export const dupLabel = (): string => t.download.statusDuplicate();
