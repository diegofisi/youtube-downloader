import { I, esc } from '../../app/icons';
import { bus } from '../../core/bus/event-bus';
import { showToast } from '../../shared/ui/toast';
import { startDownload, cancelDownload, onProgress } from '../download/download.api';
import type { DownloadOptions } from '../download/download.types';

type QStatus = 'queued' | 'downloading' | 'merging' | 'paused' | 'done' | 'error' | 'canceled';

export interface EnqueueItem {
  url: string;
  title: string;
  channel: string;
  grad: string;
  thumbnail?: string;
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
}

let items: QItem[] = [];
let concurrency = 5;
let seq = 0;

export function setConcurrency(n: number): void {
  concurrency = n <= 0 ? Infinity : n;
  pump();
}

export function enqueue(list: EnqueueItem[]): void {
  for (const it of list) {
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
  it.progress = 0;
  render();
  startDownload(it.url, it.options)
    .then((res) => {
      if (it.status === 'canceled' || it.status === 'paused') {
        render();
        pump();
        return;
      }
      if (res.success) {
        it.status = 'done';
        it.progress = 100;
        bus.emit('download:completed', { url: it.url, title: it.title, format: it.fmt });
      } else {
        it.status = 'error';
        it.error = res.error ?? 'Error desconocido';
      }
      render();
      pump();
    })
    .catch(() => {
      if (it.status !== 'canceled' && it.status !== 'paused') {
        it.status = 'error';
        it.error = 'Error interno';
      }
      render();
      pump();
    });
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
    it.progress = act === 'retry' ? 0 : it.progress;
    it.error = undefined;
  } else if (act === 'cancel') {
    cancelDownload(it.url);
    it.status = 'canceled';
  } else if (act === 'remove') {
    items = items.filter((x) => x.id !== id);
  }
  render();
  pump();
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
const QMAP: Record<QStatus, { label: string; color: string }> = {
  downloading: { label: 'Descargando', color: 'var(--accent)' },
  merging: { label: 'Procesando', color: 'var(--info)' },
  queued: { label: 'En cola', color: 'var(--text2)' },
  paused: { label: 'Pausado', color: 'var(--warn)' },
  done: { label: 'Completado', color: 'var(--success)' },
  error: { label: 'Error', color: 'var(--danger)' },
  canceled: { label: 'Cancelado', color: 'var(--text3)' },
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
  if (!listEl || !emptyEl || !statsEl) return;

  emptyEl.hidden = items.length > 0;
  const cnt = { downloading: 0, merging: 0, queued: 0, paused: 0, done: 0, error: 0, canceled: 0 };
  items.forEach((i) => cnt[i.status]++);
  const active = cnt.downloading + cnt.merging;
  const waiting = cnt.queued + cnt.paused;
  const errors = cnt.error + cnt.canceled;

  statsEl.innerHTML = items.length
    ? statBox(I.download, 'var(--accentSoft)', 'var(--accent)', active, 'Activas') +
      statBox(I.queue, 'var(--infoSoft)', 'var(--info)', waiting, 'En espera') +
      statBox(I.check, 'var(--successSoft)', 'var(--success)', cnt.done, 'Completadas') +
      statBox(I.alert, 'var(--dangerSoft)', 'var(--danger)', errors, 'Errores')
    : '';

  if (subtitle)
    subtitle.textContent = items.length
      ? `${active} activas · ${waiting} en espera · ${cnt.done} completadas`
      : 'Nada en la cola.';
  if (retryBtn) retryBtn.hidden = cnt.error === 0;

  listEl.innerHTML = items
    .map((it) => {
      const m = QMAP[it.status];
      let detail = '';
      let detailColor = 'var(--text2)';
      let actions = '';
      if (it.status === 'downloading') {
        detail = [it.speed, it.eta ? `ETA ${it.eta}` : ''].filter(Boolean).join(' · ') || `${it.progress.toFixed(0)}%`;
        actions = actionBtn(I.pause, 'Pausar', it.id, 'pause') + actionBtn(I.x, 'Cancelar', it.id, 'cancel', true);
      } else if (it.status === 'merging') {
        detail = 'Uniendo…';
        actions = actionBtn(I.x, 'Cancelar', it.id, 'cancel', true);
      } else if (it.status === 'queued') {
        detail = 'En espera';
        actions = actionBtn(I.x, 'Quitar', it.id, 'remove');
      } else if (it.status === 'paused') {
        detail = 'Pausado';
        actions = actionBtn(I.play, 'Reanudar', it.id, 'resume') + actionBtn(I.x, 'Cancelar', it.id, 'cancel', true);
      } else if (it.status === 'done') {
        detail = 'Listo';
        detailColor = 'var(--success)';
        actions = actionBtn(I.trash, 'Quitar', it.id, 'remove');
      } else {
        detail = it.status === 'error' ? 'Error' : 'Cancelado';
        detailColor = 'var(--danger)';
        actions = actionBtn(I.retry, 'Reintentar', it.id, 'retry') + actionBtn(I.trash, 'Quitar', it.id, 'remove');
      }
      const barW = it.status === 'done' || it.status === 'merging' ? 100 : it.progress;
      const anim = it.status === 'downloading' ? 'background-image:linear-gradient(45deg,rgba(255,255,255,.15) 25%,transparent 25%,transparent 50%,rgba(255,255,255,.15) 50%,rgba(255,255,255,.15) 75%,transparent 75%);background-size:28px 28px;animation:barflow .8s linear infinite;' : '';
      const thumbInner = it.thumbnail
        ? `<img src="${esc(it.thumbnail)}" style="width:100%;height:100%;object-fit:cover" alt="">`
        : `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;opacity:.85">${I.play20}</div>`;
      return `<div style="background:var(--panel);border:1px solid var(--border);border-radius:14px;padding:12px 13px">
        <div style="display:flex;align-items:center;gap:13px">
          <div style="display:flex;flex-direction:column;gap:2px;flex:none;margin-right:-4px">
            <button class="q-up" data-id="${it.id}" class="hov" title="Subir" style="width:22px;height:18px;border-radius:5px;display:flex;align-items:center;justify-content:center;color:var(--text3)"><svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="m7 14 5-5 5 5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
            <button class="q-down" data-id="${it.id}" title="Bajar" style="width:22px;height:18px;border-radius:5px;display:flex;align-items:center;justify-content:center;color:var(--text3)"><svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="m7 10 5 5 5-5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
          </div>
          <div style="position:relative;width:104px;height:60px;flex:none;border-radius:9px;overflow:hidden;background:${it.grad}">${thumbInner}</div>
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:9px;margin-bottom:3px">
              <span style="font-weight:600;font-size:13.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(it.title)}</span>
              <span style="display:inline-flex;align-items:center;font-size:11px;font-weight:600;padding:2px 8px;border-radius:7px;color:${m.color};background:color-mix(in srgb, ${m.color} 15%, transparent)">${m.label}</span>
            </div>
            <div style="font-size:12px;color:var(--text2);margin-bottom:8px">${esc(it.channel)} · ${esc(it.fmt)}</div>
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
    showToast('Reintentando', 'Recargando y reintentando fallidos.', 'info');
  });
  render();
}
