import type { DownloadOptions } from './download-options.model';

export const QueueStatus = {
  Queued: 'queued',
  Downloading: 'downloading',
  Merging: 'merging',
  Paused: 'paused',
  Done: 'done',
  Error: 'error',
  Canceled: 'canceled',
} as const;
export type QueueStatus = (typeof QueueStatus)[keyof typeof QueueStatus];

/** Pinned contract: IDENTICAL shape to vanilla queue.state.ts EnqueueItem. */
export interface EnqueueItem {
  url: string;
  /** Marks "already downloaded" even if the URL changes. */
  videoId?: string;
  title: string;
  channel: string;
  grad: string;
  thumbnail?: string;
  /** Duration in seconds (for history). */
  duration?: number;
  fmt: string;
  options: DownloadOptions;
}

export interface QueueItem extends EnqueueItem {
  id: string;
  status: QueueStatus;
  progress: number;
  speed: string;
  eta: string;
  error?: string;
  folder?: string;
  filePath?: string;
  /** Paused by an expired session, not by the user. */
  pausedByAuth?: boolean;
  /** Run generation: stale startDownload settlements (fast pause→resume) are ignored. */
  runSeq?: number;
}

export type QueueItemAction = 'pause' | 'resume' | 'retry' | 'cancel' | 'remove' | 'folder';
