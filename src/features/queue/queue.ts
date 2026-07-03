import { I, esc } from '../../app/icons';
import { bus } from '../../core/bus/event-bus';
import { t } from '../../core/i18n';
import { showToast } from '../../shared/ui/toast';
import { startDownload, cancelDownload, onProgress } from '../download/download.api';
import { addHistory, openHistoryFolder, type AddHistoryMeta } from '../library/library.api';
import { getDownloadFolder } from '../settings/settings.api';
import { attemptSilentReconnect } from '../session';
import type { DownloadOptions } from '../download/download.types';

type QStatus = 'queued' | 'downloading' | 'merging' | 'paused' | 'done' | 'error' | 'canceled';

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
interface QItem extends EnqueueItem {
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
  render();
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
  render();
  startDownload(it.url, it.options)
    .then(async (res) => {
      if (it.status === 'canceled' || it.status === 'paused') {
        render();
        pump();
        return;
      }
      if (res.success) {
        it.status = 'done';
        it.progress = 100;
        // Ruta final real del archivo (contrato nuevo de startDownload); el cast
        // es local por si el tipo de download.api aún no publica `filePath`.
        const filePath = (res as { filePath?: string }).filePath;
        if (filePath) it.filePath = filePath;
        try {
          const entry = await addHistory(it.url, it.title, it.fmt, {
            videoId: it.videoId,
            thumbnail: it.thumbnail,
            duration: it.duration,
            filePath,
          } as AddHistoryMeta);
          it.folder = entry.folder;
        } catch {
          // La descarga terminó bien; si el historial falla, no rompemos el flujo.
        }
        bus.emit('download:completed', { url: it.url, title: it.title, format: it.fmt, videoId: it.videoId });
      } else if ((res as { errorKind?: string }).errorKind === 'auth') {
        // Cookies caducadas/invalidadas: pausamos en vez de marcar error para no
        // quemar el resto de la tanda (los que siguen en cola fallarían igual).
        it.status = 'paused';
        it.pausedByAuth = true;
        it.error = t('Sesión caducada — se pausó para no fallar el resto', 'Session expired — paused to avoid failing the rest');
        for (const q of items) {
          if (q.status === 'queued') {
            q.status = 'paused';
            q.pausedByAuth = true;
          }
        }
        handleAuthFailure();
      } else {
        it.status = 'error';
        it.error = res.error ?? t('Error desconocido', 'Unknown error');
      }
      render();
      pump();
    })
    .catch(() => {
      if (it.status !== 'canceled' && it.status !== 'paused') {
        it.status = 'error';
        it.error = t('Error interno', 'Internal error');
      }
      render();
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
      showToast(t('Sesión renovada', 'Session renewed'), t('Reanudando descargas pausadas.', 'Resuming paused downloads.'), 'done');
      for (const it of items) {
        if (it.status === 'paused' && it.pausedByAuth) {
          it.status = 'queued';
          it.pausedByAuth = false;
          it.error = undefined;
        }
      }
      render();
      pump();
    } else {
      showToast(t('Tu sesión de YouTube caducó', 'Your YouTube session expired'), t('Reconecta en Mi YouTube y reanuda las descargas.', 'Reconnect in My YouTube and resume the downloads.'), 'warn');
    }
  } finally {
    authReconnectInFlight = false;
  }
}

function handleProgress(url: string, percent: number, speed: string, eta: string, status: string): void {
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
  render();
}

function action(id: string, act: string): void {
  const it = items.find((i) => i.id === id);
  if (!it) return;
  if (act === 'pause') {
    cancelDownload(it.url);
    it.status = 'paused';
    it.speed = '';
    it.eta = '';
  } else if (act === 'resume' || act === 'retry') {
    it.status = 'queued';
    if (act === 'retry') it.progress = 0; // reanudar conserva el avance (yt-dlp continúa el .part)
    it.error = undefined;
    it.pausedByAuth = false;
  } else if (act === 'cancel') {
    cancelDownload(it.url);
    it.status = 'canceled';
  } else if (act === 'remove') {
    items = items.filter((x) => x.id !== id);
  } else if (act === 'folder') {
    // Abre la carpeta contenedora del ARCHIVO real si conocemos su ruta; si no,
    // la carpeta del historial y, en último caso, la de descargas.
    const dir = (it.filePath && parentDir(it.filePath)) || it.folder;
    const p = dir ? Promise.resolve(dir) : getDownloadFolder();
    p.then((folder) => openHistoryFolder(folder)).catch(() => showToast(t('No se pudo abrir la carpeta', 'Could not open the folder'), '', 'error'));
    return;
  }
  render();
  pump();
}
/** Carpeta contenedora de una ruta (soporta separadores \ y /). */
function parentDir(p: string): string | undefined {
  const i = Math.max(p.lastIndexOf('\\'), p.lastIndexOf('/'));
  return i > 0 ? p.slice(0, i) : undefined;
}

function move(id: string, dir: number): void {
  const i = items.findIndex((x) => x.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= items.length) return;
  [items[i], items[j]] = [items[j], items[i]];
  render();
}

function emitCount(): void {
  const n = items.filter((i) => ['downloading', 'queued', 'paused', 'merging'].includes(i.status)).length;
  bus.emit('queue:count', { active: n });
}

// ---------- render ----------
const QMAP: Record<QStatus, { readonly label: string; color: string }> = {
  downloading: { get label() { return t('Descargando', 'Downloading'); }, color: 'var(--accent)' },
  merging: { get label() { return t('Procesando', 'Processing'); }, color: 'var(--info)' },
  queued: { get label() { return t('En cola', 'Queued'); }, color: 'var(--text2)' },
  paused: { get label() { return t('Pausado', 'Paused'); }, color: 'var(--warn)' },
  done: { get label() { return t('Completado', 'Completed'); }, color: 'var(--success)' },
  error: { get label() { return t('Error', 'Error'); }, color: 'var(--danger)' },
  canceled: { get label() { return t('Cancelado', 'Canceled'); }, color: 'var(--text3)' },
};

function statBox(icon: string, bg: string, color: string, value: number, label: string): string {
  return `<div style="flex:1;min-width:120px;display:flex;align-items:center;gap:11px;padding:13px 15px;background:var(--panel);border:1px solid var(--border);border-radius:13px">
    <span style="width:36px;height:36px;flex:none;border-radius:10px;display:flex;align-items:center;justify-content:center;background:${bg};color:${color}">${icon}</span>
    <div><div style="font-size:20px;font-weight:700;font-family:'SF Pro Display',system-ui,sans-serif;line-height:1">${value}</div><div style="font-size:11.5px;color:var(--text2);margin-top:3px">${label}</div></div>
  </div>`;
}
function actionBtn(icon: string, title: string, id: string, act: string, danger = false): string {
  return `<button class="q-act" data-id="${id}" data-act="${act}" title="${title}" style="width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;color:${
    danger ? 'var(--danger)' : 'var(--text2)'
  };border:1px solid var(--border)">${icon}</button>`;
}

function render(): void {
  const listEl = document.getElementById('queue-list');
  const emptyEl = document.getElementById('queue-empty');
  const statsEl = document.getElementById('queue-stats');
  const subtitle = document.getElementById('queue-subtitle');
  const retryBtn = document.getElementById('btn-retry-all');
  const clearDoneBtn = document.getElementById('btn-clear-done');
  if (!listEl || !emptyEl || !statsEl) return;

  emptyEl.hidden = items.length > 0;
  const cnt = { downloading: 0, merging: 0, queued: 0, paused: 0, done: 0, error: 0, canceled: 0 };
  items.forEach((i) => cnt[i.status]++);
  const active = cnt.downloading + cnt.merging;
  const waiting = cnt.queued + cnt.paused;
  const errors = cnt.error + cnt.canceled;

  statsEl.innerHTML = items.length
    ? statBox(I.download, 'var(--accentSoft)', 'var(--accent)', active, t('Activas', 'Active')) +
      statBox(I.queue, 'var(--infoSoft)', 'var(--info)', waiting, t('En espera', 'Waiting')) +
      statBox(I.check, 'var(--successSoft)', 'var(--success)', cnt.done, t('Completadas', 'Completed')) +
      statBox(I.alert, 'var(--dangerSoft)', 'var(--danger)', errors, t('Errores', 'Errors'))
    : '';

  if (subtitle)
    subtitle.textContent = items.length
      ? t(`${active} activas · ${waiting} en espera · ${cnt.done} completadas`, `${active} active · ${waiting} waiting · ${cnt.done} completed`)
      : t('Nada en la cola.', 'Nothing in the queue.');
  if (retryBtn) retryBtn.hidden = cnt.error === 0;
  if (clearDoneBtn) clearDoneBtn.hidden = cnt.done + cnt.canceled === 0;

  listEl.innerHTML = items
    .map((it) => {
      const m = QMAP[it.status];
      let detail = '';
      let detailColor = 'var(--text2)';
      let actions = '';
      if (it.status === 'downloading') {
        detail = [it.speed, it.eta ? `ETA ${it.eta}` : ''].filter(Boolean).join(' · ') || `${it.progress.toFixed(0)}%`;
        actions = actionBtn(I.pause, t('Pausar', 'Pause'), it.id, 'pause') + actionBtn(I.x, t('Cancelar', 'Cancel'), it.id, 'cancel', true);
      } else if (it.status === 'merging') {
        detail = t('Uniendo…', 'Merging…');
        actions = actionBtn(I.x, t('Cancelar', 'Cancel'), it.id, 'cancel', true);
      } else if (it.status === 'queued') {
        detail = t('En espera', 'Waiting');
        actions = actionBtn(I.x, t('Quitar', 'Remove'), it.id, 'remove');
      } else if (it.status === 'paused') {
        detail = t('Pausado', 'Paused');
        actions = actionBtn(I.play, t('Reanudar', 'Resume'), it.id, 'resume') + actionBtn(I.x, t('Cancelar', 'Cancel'), it.id, 'cancel', true);
      } else if (it.status === 'done') {
        detail = t('Listo', 'Done');
        detailColor = 'var(--success)';
        actions = actionBtn(I.folder, t('Abrir carpeta', 'Open folder'), it.id, 'folder') + actionBtn(I.x, t('Quitar de la lista', 'Remove from list'), it.id, 'remove');
      } else {
        detail = it.status === 'error' ? 'Error' : t('Cancelado', 'Canceled');
        detailColor = 'var(--danger)';
        actions = actionBtn(I.retry, t('Reintentar', 'Retry'), it.id, 'retry') + actionBtn(I.trash, t('Quitar de la lista', 'Remove from list'), it.id, 'remove');
      }
      const barW = it.status === 'done' || it.status === 'merging' ? 100 : it.progress;
      const anim = it.status === 'downloading' ? 'background-image:linear-gradient(45deg,rgba(255,255,255,.15) 25%,transparent 25%,transparent 50%,rgba(255,255,255,.15) 50%,rgba(255,255,255,.15) 75%,transparent 75%);background-size:28px 28px;animation:barflow .8s linear infinite;' : '';
      const thumbInner = it.thumbnail
        ? `<img src="${esc(it.thumbnail)}" style="width:100%;height:100%;object-fit:cover" alt="">`
        : `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;opacity:.85">${I.play20}</div>`;
      return `<div style="background:var(--panel);border:1px solid var(--border);border-radius:14px;padding:12px 13px">
        <div style="display:flex;align-items:center;gap:13px">
          <div style="display:flex;flex-direction:column;gap:2px;flex:none;margin-right:-4px">
            <button class="q-up hov" data-id="${it.id}" title="${t('Subir', 'Move up')}" style="width:22px;height:18px;border-radius:5px;display:flex;align-items:center;justify-content:center;color:var(--text3)"><svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="m7 14 5-5 5 5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
            <button class="q-down hov" data-id="${it.id}" title="${t('Bajar', 'Move down')}" style="width:22px;height:18px;border-radius:5px;display:flex;align-items:center;justify-content:center;color:var(--text3)"><svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="m7 10 5 5 5-5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
          </div>
          <div style="position:relative;width:104px;height:60px;flex:none;border-radius:9px;overflow:hidden;background:${it.grad}">${thumbInner}</div>
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:9px;margin-bottom:3px">
              <span style="font-weight:600;font-size:13.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(it.title)}</span>
              <span style="display:inline-flex;align-items:center;font-size:11px;font-weight:600;padding:2px 8px;border-radius:7px;color:${m.color};background:color-mix(in srgb, ${m.color} 15%, transparent)">${m.label}</span>
            </div>
            <div style="font-size:12px;color:var(--text2);margin-bottom:8px">${[it.channel, it.fmt].filter(Boolean).map(esc).join(' · ')}</div>
            <div style="display:flex;align-items:center;gap:11px">
              <div style="flex:1;height:6px;border-radius:4px;background:var(--hover);overflow:hidden"><div style="height:100%;border-radius:4px;width:${barW}%;background:${m.color};${anim}transition:width .3s"></div></div>
              <span style="font-size:11.5px;color:${detailColor};font-family:'JetBrains Mono',monospace;white-space:nowrap">${esc(detail)}</span>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:4px;flex:none">${actions}</div>
        </div>
        ${it.error ? `<div style="display:flex;align-items:center;gap:8px;margin-top:10px;padding:9px 12px;background:var(--dangerSoft);border-radius:9px;color:var(--danger);font-size:12px"><span style="display:flex;flex:none">${I.alert}</span>${esc(it.error)}</div>` : ''}
      </div>`;
    })
    .join('');

  listEl.querySelectorAll<HTMLElement>('.q-act').forEach((b) => b.addEventListener('click', () => action(b.dataset.id!, b.dataset.act!)));
  listEl.querySelectorAll<HTMLElement>('.q-up').forEach((b) => b.addEventListener('click', () => move(b.dataset.id!, -1)));
  listEl.querySelectorAll<HTMLElement>('.q-down').forEach((b) => b.addEventListener('click', () => move(b.dataset.id!, 1)));
  emitCount();
}

export function initQueueView(): void {
  onProgress((d) => handleProgress(d.url, d.percent, d.speed, d.eta, d.status));
  document.getElementById('btn-retry-all')?.addEventListener('click', () => {
    items.forEach((i) => {
      if (i.status === 'error') {
        i.status = 'queued';
        i.progress = 0;
        i.error = undefined;
      }
    });
    render();
    pump();
    showToast(t('Reintentando', 'Retrying'), t('Recargando y reintentando fallidos.', 'Re-queuing and retrying failed items.'), 'info');
  });
  document.getElementById('btn-clear-done')?.addEventListener('click', () => {
    // Solo saca de la lista los completados y cancelados; los 'error' se quedan
    // porque tienen su propio "Reintentar fallidos".
    items = items.filter((i) => i.status !== 'done' && i.status !== 'canceled');
    render();
    pump();
  });
  render();
}
