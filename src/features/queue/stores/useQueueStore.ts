// Live-process state (decision table): NEVER React Query. No React imports here.
import { create } from 'zustand';
import { toast } from 'sonner';
import { t } from '@/shared/lib/messages/t';
import { queryClient } from '@/shared/lib/query-client';
import { attemptSilentReconnect } from '@/features/session';
import { QueueStatus, type EnqueueItem, type QueueItem, type QueueItemAction } from '../models/queue-item.model';
import type { DownloadProgress } from '../models/download-progress.model';
import { startDownload } from '../api/start-download/startDownload';
import { cancelDownload } from '../api/cancel-download/cancelDownload';
import { addHistory } from '../api/add-history/addHistory';
import { getDownloadFolder } from '../api/get-download-folder/getDownloadFolder';
import { openHistoryFolder } from '../api/open-history-folder/openHistoryFolder';

interface QueueState {
  items: QueueItem[];
  concurrency: number;
}
interface QueueActions {
  enqueue: (list: EnqueueItem[]) => void;
  setConcurrency: (n: number) => void;
  handleProgress: (p: DownloadProgress) => void;
  action: (id: string, act: QueueItemAction) => void;
  move: (id: string, dir: number) => void;
  retryAllFailed: () => void;
  clearFinished: () => void;
  reset: () => void;
}
export type QueueStore = QueueState & QueueActions;

const initialState: QueueState = { items: [], concurrency: 5 };

let seq = 0;
/** Single-flight: avoids launching several reconnect attempts when many items fail at once. */
let authReconnectInFlight = false;

const PENDING_STATUSES: QueueStatus[] = [
  QueueStatus.Queued,
  QueueStatus.Downloading,
  QueueStatus.Merging,
  QueueStatus.Paused,
];

const LIVE_STATUSES: QueueStatus[] = [
  QueueStatus.Downloading,
  QueueStatus.Queued,
  QueueStatus.Paused,
  QueueStatus.Merging,
];

/** Replaces the vanilla 'queue:count' bus event. */
export const selectActiveCount = (s: QueueStore): number =>
  s.items.filter((i) => LIVE_STATUSES.includes(i.status)).length;

export const useQueueStore = create<QueueStore>((set, get) => ({
  ...initialState,

  enqueue: (list) => {
    const items = [...get().items];
    for (const it of list) {
      const dup = items.find((x) => x.url === it.url && PENDING_STATUSES.includes(x.status));
      if (dup) {
        toast.warning(t.queue.alreadyQueuedToast(), { description: it.title });
        continue;
      }
      items.push({ ...it, id: `q${++seq}`, status: QueueStatus.Queued, progress: 0, speed: '', eta: '' });
    }
    set({ items });
    pump();
  },

  setConcurrency: (n) => {
    set({ concurrency: n <= 0 ? Infinity : n });
    pump();
  },

  handleProgress: (p) => {
    const it = get().items.find(
      (i) => i.url === p.url && (i.status === QueueStatus.Downloading || i.status === QueueStatus.Merging),
    );
    if (!it) return;
    if (p.status === 'processing') {
      patch(it.id, { status: QueueStatus.Merging });
      return;
    }
    patch(it.id, { status: QueueStatus.Downloading, progress: p.percent, speed: p.speed, eta: p.eta });
  },

  action: (id, act) => {
    const it = get().items.find((i) => i.id === id);
    if (!it) return;
    if (act === 'pause') {
      void cancelDownload(it.url).catch(() => {});
      patch(id, { status: QueueStatus.Paused, speed: '', eta: '' });
      pump();
      return;
    }
    if (act === 'resume' || act === 'retry') {
      // resume keeps progress (yt-dlp continues the .part file); only retry resets it
      patch(id, {
        status: QueueStatus.Queued,
        ...(act === 'retry' ? { progress: 0 } : {}),
        error: undefined,
        pausedByAuth: false,
      });
      pump();
      return;
    }
    if (act === 'cancel') {
      void cancelDownload(it.url).catch(() => {});
      patch(id, { status: QueueStatus.Canceled });
      pump();
      return;
    }
    if (act === 'remove') {
      set({ items: get().items.filter((x) => x.id !== id) });
      pump();
      return;
    }
    if (act === 'folder') {
      // Fallback chain (vanilla parity): file's folder → history folder → downloads.
      const dir = (it.filePath && parentDir(it.filePath)) || it.folder;
      const p = dir ? Promise.resolve(dir) : getDownloadFolder();
      p.then((folder) => openHistoryFolder(folder)).catch(() =>
        toast.error(t.common.couldNotOpenFolder()),
      );
    }
  },

  move: (id, dir) => {
    const items = [...get().items];
    const i = items.findIndex((x) => x.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= items.length) return;
    [items[i], items[j]] = [items[j], items[i]];
    set({ items });
  },

  retryAllFailed: () => {
    set({
      items: get().items.map((i) =>
        i.status === QueueStatus.Error ? { ...i, status: QueueStatus.Queued, progress: 0, error: undefined } : i,
      ),
    });
    pump();
    // Keep the original render → pump → toast order.
    toast.info(t.queue.retrying(), {
      description: t.queue.retryAllToast(),
    });
  },

  clearFinished: () => {
    // 'error' items stay — they have their own "Retry failed" action.
    set({
      items: get().items.filter((i) => i.status !== QueueStatus.Done && i.status !== QueueStatus.Canceled),
    });
    pump();
  },

  reset: () => set(initialState),
}));

function patch(id: string, changes: Partial<QueueItem>): void {
  useQueueStore.setState((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, ...changes } : i)) }));
}

function findItem(id: string): QueueItem | undefined {
  return useQueueStore.getState().items.find((i) => i.id === id);
}

function activeCount(): number {
  return useQueueStore
    .getState()
    .items.filter((i) => i.status === QueueStatus.Downloading || i.status === QueueStatus.Merging).length;
}

function pump(): void {
  while (activeCount() < useQueueStore.getState().concurrency) {
    const next = useQueueStore.getState().items.find((i) => i.status === QueueStatus.Queued);
    if (!next) break;
    run(next.id);
  }
}

function run(id: string): void {
  const it = findItem(id);
  if (!it) return;
  const runId = (it.runSeq ?? 0) + 1;
  // Don't reset progress: on resume yt-dlp continues the .part file, so keep the
  // shown progress until the first real progress event arrives.
  patch(id, { status: QueueStatus.Downloading, runSeq: runId });
  startDownload(it.url, it.options)
    .then(async (res) => {
      const cur = findItem(id);
      if (!cur || cur.runSeq !== runId) return; // a newer run owns this item
      if (cur.status === QueueStatus.Canceled || cur.status === QueueStatus.Paused) {
        pump();
        return;
      }
      if (res.success) {
        patch(id, { status: QueueStatus.Done, progress: 100, ...(res.filePath ? { filePath: res.filePath } : {}) });
        try {
          const entry = await addHistory(it.url, it.title, it.fmt, {
            videoId: it.videoId,
            thumbnail: it.thumbnail,
            duration: it.duration,
            filePath: res.filePath,
          });
          patch(id, { folder: entry.folder });
        } catch {
          // Download succeeded; a history failure must not break the flow.
        }
        // Replaces the 'download:completed' bus event so Biblioteca refetches live.
        void queryClient.invalidateQueries({ queryKey: ['library', 'history'] });
      } else if (res.errorKind === 'auth') {
        // Expired cookies: pause instead of erroring so the rest of the batch
        // isn't burned (queued items would fail the same way).
        useQueueStore.setState((s) => ({
          items: s.items.map((q) => {
            if (q.id === id) {
              return {
                ...q,
                status: QueueStatus.Paused,
                pausedByAuth: true,
                error: t.queue.authPausedToast(),
              };
            }
            if (q.status === QueueStatus.Queued) return { ...q, status: QueueStatus.Paused, pausedByAuth: true };
            return q;
          }),
        }));
        void handleAuthFailure();
      } else {
        patch(id, { status: QueueStatus.Error, error: res.error ?? t.queue.unknownError() });
      }
      pump();
    })
    .catch(() => {
      const cur = findItem(id);
      if (!cur || cur.runSeq !== runId) return; // a newer run owns this item
      if (cur.status !== QueueStatus.Canceled && cur.status !== QueueStatus.Paused) {
        patch(id, { status: QueueStatus.Error, error: t.queue.internalError() });
      }
      pump();
    });
}

/** After the first auth failure, tries to silently renew the session (single-flight). */
async function handleAuthFailure(): Promise<void> {
  if (authReconnectInFlight) return;
  authReconnectInFlight = true;
  try {
    const ok = await attemptSilentReconnect().catch(() => false);
    if (ok) {
      toast.success(t.queue.sessionRenewedToast(), {
        description: t.queue.resumingToast(),
      });
      useQueueStore.setState((s) => ({
        items: s.items.map((i) =>
          i.status === QueueStatus.Paused && i.pausedByAuth
            ? { ...i, status: QueueStatus.Queued, pausedByAuth: false, error: undefined }
            : i,
        ),
      }));
      pump();
    } else {
      toast.warning(t.queue.sessionExpiredTitle(), {
        description: t.queue.sessionExpiredBody(),
      });
    }
  } finally {
    authReconnectInFlight = false;
  }
}

/** Handles both \ and / separators. */
function parentDir(p: string): string | undefined {
  const i = Math.max(p.lastIndexOf('\\'), p.lastIndexOf('/'));
  return i > 0 ? p.slice(0, i) : undefined;
}
