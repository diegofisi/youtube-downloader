// Estado y scheduler de la cola de descargas (Fase 3 del refactor auditado).
// Movido desde queue.ts para que la lógica más crítica de la app (enqueue/pump/
// run/handleAuthFailure/reintentos por sesión) sea testeable sin DOM (Fase 4).
// Regla: este módulo NO importa nada de DOM; la vista (ui/queue-view.ts) se
// suscribe vía subscribe() y este módulo solo notifica cambios.
// Decisión sobre toasts: se quedan aquí importando shared/ui/toast (opción
// pragmática permitida por la auditoría). showToast es un efecto de UI pero no
// toca el DOM de la cola ni crea acoplamiento state→view dentro del slice; en
// tests se puede stubear el módulo de toast sin necesidad de DOM real.
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
  /** Id del video (p. ej. id de YouTube); permite marcar "ya descargado" aunque cambie la URL. */
  videoId?: string;
  title: string;
  channel: string;
  grad: string;
  thumbnail?: string;
  /** Duración en segundos (para el historial). */
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
  /** Carpeta donde quedó el archivo (la devuelve addHistory al completar). */
  folder?: string;
  /** Ruta final real del archivo descargado (la devuelve startDownload al completar). */
  filePath?: string;
  /** true si lo pausamos nosotros por sesión caducada (no el usuario a mano). */
  pausedByAuth?: boolean;
}

let items: QItem[] = [];
let concurrency = 5;
let seq = 0;
/** Single-flight: evita lanzar varios intentos de reconexión si fallan varios items a la vez. */
let authReconnectInFlight = false;

// ---------- suscripción (desacople state → view) ----------
// Cada sitio que antes llamaba render() ahora llama notify(); la vista se
// registra con subscribe() y decide cómo pintar. Las notificaciones son
// síncronas para conservar el orden exacto render→pump del código original.
type Listener = () => void;
const listeners: Listener[] = [];
export function subscribe(fn: Listener): void {
  listeners.push(fn);
}
function notify(): void {
  for (const fn of listeners) fn();
}

/** Snapshot de solo lectura para la vista (items se reasigna en remove/clear). */
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
  // No se resetea it.progress: al reanudar, yt-dlp retoma el archivo .part y
  // conservamos el avance hasta que llegue el primer evento de progreso real.
  // (Los items nuevos y los reintentos ya entran con progress = 0.)
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
        // Ruta final real del archivo descargado.
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
          // La descarga terminó bien; si el historial falla, no rompemos el flujo.
        }
        bus.emit('download:completed', { url: it.url, title: it.title, format: it.fmt, videoId: it.videoId });
      } else if (res.errorKind === 'auth') {
        // Cookies caducadas/invalidadas: pausamos en vez de marcar error para no
        // quemar el resto de la tanda (los que siguen en cola fallarían igual).
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

/** Tras la primera falla de auth intenta renovar la sesión en silencio (single-flight). */
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
    if (act === 'retry') it.progress = 0; // reanudar conserva el avance (yt-dlp continúa el .part)
    it.error = undefined;
    it.pausedByAuth = false;
  } else if (act === 'cancel') {
    void cancelDownload(it.url).catch(() => {});
    it.status = 'canceled';
  } else if (act === 'remove') {
    items = items.filter((x) => x.id !== id);
  } else if (act === 'folder') {
    // Abre la carpeta contenedora del ARCHIVO real si conocemos su ruta; si no,
    // la carpeta del historial y, en último caso, la de descargas. (Es efecto de
    // library/settings, no de DOM, por eso se queda en el state.)
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
/** Carpeta contenedora de una ruta (soporta separadores \ y /). */
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

/**
 * Publica el nº de items "vivos" en el bus. Exportada porque el render de la
 * vista la llama al final (igual que el render original) además de pump():
 * el orden pump→emitCount→run→render→emitCount debe conservarse idéntico.
 */
export function emitCount(): void {
  const n = items.filter((i) => ['downloading', 'queued', 'paused', 'merging'].includes(i.status)).length;
  bus.emit('queue:count', { active: n });
}

/**
 * Reencola todos los fallidos (botón "Reintentar fallidos"). Vive aquí y no en
 * la vista porque muta items; la vista solo la cablea al click.
 * Orden original conservado: render → pump → toast.
 */
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

/** Limpia completados/cancelados (botón "Limpiar"). Muta items → vive en el state. */
export function clearFinished(): void {
  // Solo saca de la lista los completados y cancelados; los 'error' se quedan
  // porque tienen su propio "Reintentar fallidos".
  items = items.filter((i) => i.status !== 'done' && i.status !== 'canceled');
  notify();
  pump();
}
