// Render DOM de la cola (Fase 3 del refactor auditado). Movido desde queue.ts
// para que el scheduler (queue.state.ts) sea testeable sin DOM. Esta vista
// importa el state, nunca al revés: se registra con subscribe() y repinta.
import { I } from '../../../shared/ui/icons';
import { esc } from '../../../shared/lib/html';
import { t } from '../../../core/i18n';
import { onProgress } from '../../download';
import {
  action,
  clearFinished,
  emitCount,
  getItems,
  handleProgress,
  move,
  retryAllFailed,
  subscribe,
} from '../queue.state';
import type { QStatus } from '../queue.state';

const QMAP: Record<QStatus, { readonly label: string; color: string }> = {
  downloading: {
    get label() {
      return t('Descargando', 'Downloading');
    },
    color: 'var(--accent)',
  },
  merging: {
    get label() {
      return t('Procesando', 'Processing');
    },
    color: 'var(--info)',
  },
  queued: {
    get label() {
      return t('En cola', 'Queued');
    },
    color: 'var(--text2)',
  },
  paused: {
    get label() {
      return t('Pausado', 'Paused');
    },
    color: 'var(--warn)',
  },
  done: {
    get label() {
      return t('Completado', 'Completed');
    },
    color: 'var(--success)',
  },
  error: {
    get label() {
      return t('Error', 'Error');
    },
    color: 'var(--danger)',
  },
  canceled: {
    get label() {
      return t('Cancelado', 'Canceled');
    },
    color: 'var(--text3)',
  },
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
  const items = getItems();
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
      ? t(
          `${active} activas · ${waiting} en espera · ${cnt.done} completadas`,
          `${active} active · ${waiting} waiting · ${cnt.done} completed`,
        )
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
        actions =
          actionBtn(I.pause, t('Pausar', 'Pause'), it.id, 'pause') +
          actionBtn(I.x, t('Cancelar', 'Cancel'), it.id, 'cancel', true);
      } else if (it.status === 'merging') {
        detail = t('Uniendo…', 'Merging…');
        actions = actionBtn(I.x, t('Cancelar', 'Cancel'), it.id, 'cancel', true);
      } else if (it.status === 'queued') {
        detail = t('En espera', 'Waiting');
        actions = actionBtn(I.x, t('Quitar', 'Remove'), it.id, 'remove');
      } else if (it.status === 'paused') {
        detail = t('Pausado', 'Paused');
        actions =
          actionBtn(I.play, t('Reanudar', 'Resume'), it.id, 'resume') +
          actionBtn(I.x, t('Cancelar', 'Cancel'), it.id, 'cancel', true);
      } else if (it.status === 'done') {
        detail = t('Listo', 'Done');
        detailColor = 'var(--success)';
        actions =
          actionBtn(I.folder, t('Abrir carpeta', 'Open folder'), it.id, 'folder') +
          actionBtn(I.x, t('Quitar de la lista', 'Remove from list'), it.id, 'remove');
      } else {
        detail = it.status === 'error' ? 'Error' : t('Cancelado', 'Canceled');
        detailColor = 'var(--danger)';
        actions =
          actionBtn(I.retry, t('Reintentar', 'Retry'), it.id, 'retry') +
          actionBtn(I.trash, t('Quitar de la lista', 'Remove from list'), it.id, 'remove');
      }
      const barW = it.status === 'done' || it.status === 'merging' ? 100 : it.progress;
      const anim =
        it.status === 'downloading'
          ? 'background-image:linear-gradient(45deg,rgba(255,255,255,.15) 25%,transparent 25%,transparent 50%,rgba(255,255,255,.15) 50%,rgba(255,255,255,.15) 75%,transparent 75%);background-size:28px 28px;animation:barflow .8s linear infinite;'
          : '';
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

  listEl
    .querySelectorAll<HTMLElement>('.q-act')
    .forEach((b) => b.addEventListener('click', () => action(b.dataset.id!, b.dataset.act!)));
  listEl
    .querySelectorAll<HTMLElement>('.q-up')
    .forEach((b) => b.addEventListener('click', () => move(b.dataset.id!, -1)));
  listEl
    .querySelectorAll<HTMLElement>('.q-down')
    .forEach((b) => b.addEventListener('click', () => move(b.dataset.id!, 1)));
  // El render original terminaba con emitCount(); se conserva aquí (y no en el
  // notify del state) para mantener idéntico el orden de emits en 'queue:count'.
  emitCount();
}

export function initQueueView(): void {
  void onProgress((d) => handleProgress(d.url, d.percent, d.speed, d.eta, d.status));
  // La mutación de items (reintentar/limpiar) vive en el state; aquí solo se
  // cablean los botones. El toast de "Reintentando" lo emite el propio state
  // tras render+pump, igual que en el código original.
  document.getElementById('btn-retry-all')?.addEventListener('click', retryAllFailed);
  document.getElementById('btn-clear-done')?.addEventListener('click', clearFinished);
  // A partir de aquí cada cambio de estado repinta la vista.
  subscribe(render);
  render();
}
