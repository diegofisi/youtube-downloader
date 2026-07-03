// Download queue state and scheduler, DOM-free so it stays testable; the view subscribes via subscribe().
// Toasts are allowed here: showToast never touches queue DOM and can be stubbed in tests.
import { bus } from '../../core/bus/event-bus';
import { t } from '../../core/i18n';
import { showToast } from '../../shared/ui/toast';
import { startDownload, cancelDownload } from '../download';
import { addHistory, openHistoryFolder } from '../library';
import { getDownloadFolder } from '../settings';
import { attemptSilentReconnect } from '../session';
import type { DownloadOptions } from '../download';

export type QStatus = 'queued' | 'downloading' | 'merging' | 'paused' | 'done' | 'error' | 'canceled';

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
export interface QItem extends EnqueueItem {
  id: string;
  status: QStatus;
  progress: number;
  speed: string;
  eta: string;
  error?: string;
  /** Folder where the file ended up (returned by addHistory on completion). */
  folder?: string;
  /** Actual final path of the downloaded file (returned by startDownload on completion). */
  filePath?: string;
  /** true if we paused it due to an expired session (not the user manually). */
  pausedByAuth?: boolean;
}

let items: QItem[] = [];
let concurrency = 5;
let seq = 0;
/** Single-flight: avoids launching several reconnect attempts when many items fail at once. */
let authReconnectInFlight = false;

// ---------- subscription (state → view decoupling) ----------
// Notifications are synchronous to preserve the original exact render→pump ordering.
type Listener = () => void;
const listeners: Listener[] = [];
export function subscribe(fn: Listener): void {
  listeners.push(fn);
}
function notify(): void {
  for (const fn of listeners) fn();
}

/** Read-only snapshot for the view (items is reassigned in remove/clear). */
export function getItems(): readonly QItem[] {
  return items;
}

export function setConcurrency(n: number): void {
  concurrency = n <= 0 ? Infinity : n;
  pump();
}

const PENDING_STATUSES: QStatus[] = ['queued', 'downloading', 'merging', 'paused'];

export function enqueue(list: EnqueueItem[]): void {
  for (const it of list) {
    const dup = items.find((x) => x.url === it.url && PENDING_STATUSES.includes(x.status));
    if (dup) {
      showToast(t('Ya está en la cola', 'Already in the queue'), it.title, 'warn');
      continue;
    }
    items.push({ ...it, id: `q${++seq}`, status: 'queued', progress: 0, speed: '', eta: '' });
  }
  notify();
  pump();
}

function activeCount(): number {
  return items.filter((i) => i.status === 'downloading' || i.status === 'merging').length;
}

function pump(): void {
  emitCount();
  while (activeCount() < concurrency) {
    const next = items.find((i) => i.status === 'queued');
    if (!next) break;
    run(next);
  }
}

function run(it: QItem): void {
  it.status = 'downloading';
  // Don't reset it.progress: on resume yt-dlp continues the .part file, so keep
  // the shown progress until the first real progress event arrives.
  notify();
  startDownload(it.url, it.options)
    .then(async (res) => {
      if (it.status === 'canceled' || it.status === 'paused') {
        notify();
        pump();
        return;
      }
      if (res.success) {
        it.status = 'done';
        it.progress = 100;
        const filePath = res.filePath;
        if (filePath) it.filePath = filePath;
        try {
          const entry = await addHistory(it.url, it.title, it.fmt, {
            videoId: it.videoId,
            thumbnail: it.thumbnail,
            duration: it.duration,
            filePath,
          });
          it.folder = entry.folder;
        } catch {
          // Download succeeded; a history failure must not break the flow.
        }
        bus.emit('download:completed', { url: it.url, title: it.title, format: it.fmt, videoId: it.videoId });
      } else if (res.errorKind === 'auth') {
        // Expired/invalidated cookies: pause instead of erroring so the rest of
        // the batch isn't burned (queued items would fail the same way).
        it.status = 'paused';
        it.pausedByAuth = true;
        it.error = t(
          'Sesión caducada — se pausó para no fallar el resto',
          'Session expired — paused to avoid failing the rest',
        );
        for (const q of items) {
          if (q.status === 'queued') {
            q.status = 'paused';
            q.pausedByAuth = true;
          }
        }
        void handleAuthFailure();
      } else {
        it.status = 'error';
        it.error = res.error ?? t('Error desconocido', 'Unknown error');
      }
      notify();
      pump();
    })
    .catch(() => {
      if (it.status !== 'canceled' && it.status !== 'paused') {
        it.status = 'error';
        it.error = t('Error interno', 'Internal error');
      }
      notify();
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
      showToast(
        t('Sesión renovada', 'Session renewed'),
        t('Reanudando descargas pausadas.', 'Resuming paused downloads.'),
        'done',
      );
      for (const it of items) {
        if (it.status === 'paused' && it.pausedByAuth) {
          it.status = 'queued';
          it.pausedByAuth = false;
          it.error = undefined;
        }
      }
      notify();
      pump();
    } else {
      showToast(
        t('Tu sesión de YouTube caducó', 'Your YouTube session expired'),
        t('Reconecta en Mi YouTube y reanuda las descargas.', 'Reconnect in My YouTube and resume the downloads.'),
        'warn',
      );
    }
  } finally {
    authReconnectInFlight = false;
  }
}

export function handleProgress(url: string, percent: number, speed: string, eta: string, status: string): void {
  const it = items.find((i) => i.url === url && (i.status === 'downloading' || i.status === 'merging'));
  if (!it) return;
  if (status === 'processing') {
    it.status = 'merging';
  } else {
    it.status = 'downloading';
    it.progress = percent;
    it.speed = speed;
    it.eta = eta;
  }
  notify();
}

export function action(id: string, act: string): void {
  const it = items.find((i) => i.id === id);
  if (!it) return;
  if (act === 'pause') {
    void cancelDownload(it.url).catch(() => {});
    it.status = 'paused';
    it.speed = '';
    it.eta = '';
  } else if (act === 'resume' || act === 'retry') {
    it.status = 'queued';
    if (act === 'retry') it.progress = 0; // resume keeps progress (yt-dlp continues the .part file)
    it.error = undefined;
    it.pausedByAuth = false;
  } else if (act === 'cancel') {
    void cancelDownload(it.url).catch(() => {});
    it.status = 'canceled';
  } else if (act === 'remove') {
    items = items.filter((x) => x.id !== id);
  } else if (act === 'folder') {
    // Open the real file's containing folder if known; else the history folder,
    // else the downloads folder. Library/settings effect, not DOM, so it stays in state.
    const dir = (it.filePath && parentDir(it.filePath)) || it.folder;
    const p = dir ? Promise.resolve(dir) : getDownloadFolder();
    p.then((folder) => openHistoryFolder(folder)).catch(() =>
      showToast(t('No se pudo abrir la carpeta', 'Could not open the folder'), '', 'error'),
    );
    return;
  }
  notify();
  pump();
}
/** Containing folder of a path (supports both \ and / separators). */
function parentDir(p: string): string | undefined {
  const i = Math.max(p.lastIndexOf('\\'), p.lastIndexOf('/'));
  return i > 0 ? p.slice(0, i) : undefined;
}

export function move(id: string, dir: number): void {
  const i = items.findIndex((x) => x.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= items.length) return;
  [items[i], items[j]] = [items[j], items[i]];
  notify();
}

/** Publishes the live-item count on the bus. Exported because the view's render also calls
 * it after pump(): the pump→emitCount→run→render→emitCount ordering must stay identical. */
export function emitCount(): void {
  const n = items.filter((i) => ['downloading', 'queued', 'paused', 'merging'].includes(i.status)).length;
  bus.emit('queue:count', { active: n });
}

/** Re-queues all failed items ("Retry failed" button). Lives here because it mutates
 * items; the view only wires the click. Original render → pump → toast order kept. */
export function retryAllFailed(): void {
  items.forEach((i) => {
    if (i.status === 'error') {
      i.status = 'queued';
      i.progress = 0;
      i.error = undefined;
    }
  });
  notify();
  pump();
  showToast(
    t('Reintentando', 'Retrying'),
    t('Recargando y reintentando fallidos.', 'Re-queuing and retrying failed items.'),
    'info',
  );
}

/** Clears done/canceled items ("Clear" button). Mutates items, so it lives in state. */
export function clearFinished(): void {
  // Only removes done/canceled; 'error' items stay — they have their own "Retry failed".
  items = items.filter((i) => i.status !== 'done' && i.status !== 'canceled');
  notify();
  pump();
}
