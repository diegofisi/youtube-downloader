import type { DownloadOptions } from './download-options.model';

/** Queue item lifecycle — const object + type (never a TS enum). */
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
  /** Video id (e.g. YouTube id); lets us mark "already downloaded" even if the URL changes. */
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
  /** Folder where the file ended up (returned by add_history on completion). */
  folder?: string;
  /** Actual final path of the downloaded file (returned by start_download on completion). */
  filePath?: string;
  /** true if we paused it due to an expired session (not the user manually). */
  pausedByAuth?: boolean;
  /** Run generation: stale startDownload settlements (fast pause→resume) are ignored. */
  runSeq?: number;
}

/** Per-item actions the view can trigger (vanilla queue.state action()). */
export type QueueItemAction = 'pause' | 'resume' | 'retry' | 'cancel' | 'remove' | 'folder';
