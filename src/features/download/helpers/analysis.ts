import { parseAnalyzeEntryError } from '@/shared/lib/analyze-entry-error';
import { t } from '@/shared/lib/messages/t';
import type { AnalyzedEntry, AnalyzedVideo, FlatVideo } from '../models/analyzed.model';

export function flattenVideos(entries: AnalyzedEntry[]): FlatVideo[] {
  const out: FlatVideo[] = [];
  const seenIds = new Set<string>();
  for (const e of entries) {
    const vids = e.isPlaylist ? e.entries : [e];
    // Two passes per entry: dups are only marked across entries, like vanilla.
    // Error entries have no id and must never count as duplicates of each other.
    for (const v of vids) out.push({ ...v, dup: v.id !== '' && seenIds.has(v.id) });
    for (const v of vids) if (v.id) seenIds.add(v.id);
  }
  return out;
}

export type VideoStatus = 'ok' | 'members' | 'downloaded' | 'private' | 'region' | 'error' | 'auth';

/** Unavailable states win over "already downloaded": a blocked video must not be enqueueable. */
export function statusOf(v: AnalyzedVideo, downloaded: ReadonlySet<string>): VideoStatus {
  const a = v.availability;
  const err = parseAnalyzeEntryError(a);
  if (err) return err.auth ? 'auth' : 'error';
  if (a === 'private') return 'private';
  if (a?.includes('region')) return 'region';
  if (downloaded.has(v.id) || downloaded.has(v.url)) return 'downloaded';
  if (!a) return 'ok';
  if (a === 'subscriber_only' || a === 'premium_only' || a === 'needs_auth') return 'members';
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
  auth: {
    label: () => t.download.statusNeedsSession(),
    tone: 'text-warn bg-warn/15',
    downloadable: false,
  },
};

export const DUP_TONE = 'text-faint bg-faint/15';
export const dupLabel = (): string => t.download.statusDuplicate();
