import { startDownload, cancelDownload, onProgress } from '../download.api';
import type { ProgressData } from '../download.types';
import { getCookieMode, updateCookieStatus, loadCookies } from '../../session';
import { showModal } from '../../../shared/ui/modal';
import { showToast } from '../../../shared/ui/toast';

const urlInput = document.getElementById('url-input') as HTMLTextAreaElement;
const downloadBtn = document.getElementById('btn-download') as HTMLButtonElement;
const urlCountEl = document.getElementById('url-count') as HTMLSpanElement;
const queueSection = document.getElementById('download-queue') as HTMLElement;
const queueList = document.getElementById('queue-list') as HTMLElement;
const queueStats = document.getElementById('queue-stats') as HTMLElement;
const queueBar = document.getElementById('queue-bar') as HTMLElement;
const queueStatus = document.getElementById('queue-status') as HTMLElement;
const queuePercent = document.getElementById('queue-percent') as HTMLElement;
const retryBtn = document.getElementById('btn-retry') as HTMLButtonElement;
const queueActionsAlways = document.getElementById('queue-actions-always') as HTMLElement;
const reloadCookiesBtn = document.getElementById('btn-reload-cookies') as HTMLButtonElement;
const retryCountEl = document.getElementById('retry-count') as HTMLSpanElement;

const DOWNLOAD_ICON = `
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>`;

const ICON_PENDING = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
const ICON_DOWNLOADING = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;
const ICON_DONE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`;
const ICON_ERROR = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
const ICON_CLOSE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

const concurrentSelect = document.getElementById('concurrent-select') as HTMLSelectElement;

function getMaxConcurrent(): number {
  const val = parseInt(concurrentSelect.value, 10);
  return val === 0 ? Infinity : val;
}

interface QueueItem {
  url: string;
  label: string;
  status: 'pending' | 'downloading' | 'done' | 'error' | 'cancelled' | 'removed';
  percent: number;
  speed: string;
  eta: string;
  error?: string;
  el: HTMLElement;
}

let items: QueueItem[] = [];
let isDownloading = false;
let tryNextFn: (() => void) | null = null;

function getVideoId(url: string): string {
  try {
    const u = new URL(url);
    return u.searchParams.get('v') ?? url.split('/').pop() ?? url;
  } catch {
    return url;
  }
}

function getUrls(): string[] {
  return urlInput.value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('http'));
}

function updateUrlCount(): void {
  const count = getUrls().length;
  if (count > 1) {
    urlCountEl.textContent = `${count} URLs`;
    urlCountEl.style.display = 'inline';
  } else {
    urlCountEl.style.display = 'none';
  }
}

function handleItemAction(item: QueueItem): void {
  if (item.status === 'pending') {
    item.status = 'removed';
    item.el.remove();
    updateOverall();
    tryNextFn?.();
  } else if (item.status === 'downloading') {
    cancelDownload(item.url);
    item.status = 'cancelled';
    item.error = 'Cancelado por el usuario';
    renderItem(item);
    updateOverall();
  } else if (item.status === 'error' || item.status === 'cancelled') {
    item.status = 'removed';
    item.el.remove();
    updateOverall();
  }
}

function createItemEl(item: QueueItem): HTMLElement {
  const el = document.createElement('div');
  el.className = 'qi qi--pending';
  el.innerHTML = `
    <div class="qi-icon">${ICON_PENDING}</div>
    <div class="qi-body">
      <div class="qi-name">${item.label}</div>
      <div class="qi-bar"><div class="qi-fill" style="width:0%"></div></div>
    </div>
    <div class="qi-stat">En cola</div>
    <button class="qi-action" title="Quitar">${ICON_CLOSE}</button>`;

  el.querySelector('.qi-action')!.addEventListener('click', (e) => {
    e.stopPropagation();
    handleItemAction(item);
  });

  return el;
}

function renderItem(item: QueueItem): void {
  const icon = item.el.querySelector('.qi-icon')!;
  const fill = item.el.querySelector('.qi-fill') as HTMLElement;
  const stat = item.el.querySelector('.qi-stat')!;
  const actionBtn = item.el.querySelector('.qi-action') as HTMLElement;

  item.el.className = `qi qi--${item.status}`;

  switch (item.status) {
    case 'pending':
      icon.innerHTML = ICON_PENDING;
      fill.style.width = '0%';
      stat.textContent = 'En cola';
      actionBtn.title = 'Quitar de la cola';
      actionBtn.style.display = '';
      break;
    case 'downloading':
      icon.innerHTML = ICON_DOWNLOADING;
      fill.style.width = `${item.percent}%`;
      stat.textContent = item.percent > 0 ? `${item.percent.toFixed(0)}%` : 'Iniciando';
      actionBtn.title = 'Cancelar descarga';
      actionBtn.style.display = '';
      break;
    case 'done':
      icon.innerHTML = ICON_DONE;
      fill.style.width = '100%';
      stat.textContent = 'Listo';
      actionBtn.style.display = 'none';
      break;
    case 'error':
    case 'cancelled': {
      icon.innerHTML = ICON_ERROR;
      fill.style.width = '0%';
      stat.textContent = 'Error';
      actionBtn.title = 'Quitar';
      actionBtn.style.display = '';
      const nameEl = item.el.querySelector('.qi-name')!;
      const errMsg = item.error ?? 'Error desconocido';
      nameEl.innerHTML = `${item.label}<br><span class="qi-error-msg">${errMsg}</span>`;
      break;
    }
  }
}

function updateOverall(): void {
  const visible = items.filter((i) => i.status !== 'removed');
  const total = visible.length;
  const done = visible.filter((i) => i.status === 'done').length;
  const errors = visible.filter((i) => i.status === 'error' || i.status === 'cancelled').length;
  const finished = done + errors;
  const active = visible.filter((i) => i.status === 'downloading').length;

  queueStats.textContent = `${done} completados${errors > 0 ? ` · ${errors} errores` : ''} · ${active} activos`;

  const overallPct = total > 0 ? (finished / total) * 100 : 0;
  queueBar.style.width = `${overallPct}%`;
  queuePercent.textContent = `${finished}/${total}`;
  queueStatus.textContent = finished < total ? 'Descargando...' : 'Finalizado';

  queueActionsAlways.style.display = '';
  const hasErrors = errors > 0;
  retryBtn.style.display = hasErrors ? '' : 'none';
  retryBtn.disabled = false;
  if (hasErrors) {
    retryCountEl.textContent = String(errors);
  }

  if (isDownloading) {
    downloadBtn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <line x1="15" y1="9" x2="9" y2="15"/>
        <line x1="9" y1="9" x2="15" y2="15"/>
      </svg>
      ${finished}/${total} DESCARGADOS...`;
  }
}

function processQueue(cookieMode: string): Promise<void> {
  return new Promise((resolve) => {
    function tryNext(): void {
      const active = items.filter((i) => i.status === 'downloading').length;
      const next = items.find((i) => i.status === 'pending');

      if (!next && active === 0) {
        tryNextFn = null;
        resolve();
        return;
      }

      if (next && active < getMaxConcurrent()) {
        next.status = 'downloading';
        next.percent = 0;
        renderItem(next);
        updateOverall();

        startDownload(next.url, cookieMode).then((result) => {
          if (next.status === 'cancelled' || next.status === 'removed') {
            updateOverall();
            tryNext();
            return;
          }

          if (result.success) {
            next.status = 'done';
            next.percent = 100;
            showToast(`${next.label} descargado`, 'success');
          } else {
            next.status = 'error';
            next.error = result.error ?? 'Error desconocido';
          }
          renderItem(next);
          updateOverall();
          tryNext();
        });

        tryNext();
      }
    }

    tryNextFn = tryNext;
    tryNext();
  });
}

function handleProgress(data: ProgressData): void {
  const item = items.find((i) => i.url === data.url && i.status === 'downloading');
  if (!item) return;

  item.percent = data.percent;
  item.speed = data.speed;
  item.eta = data.eta;
  renderItem(item);
}

async function handleDownload(): Promise<void> {
  if (isDownloading) return;

  const urls = getUrls();
  if (urls.length === 0) {
    await showModal('Sin URLs', 'Ingresa al menos una URL válida de YouTube.');
    return;
  }

  const cookieMode = getCookieMode();
  if (cookieMode === 'none') {
    const proceed = await showModal(
      'Sin cookies',
      'No has seleccionado un navegador ni cargado cookies.\n\nSin cookies solo puedes descargar videos públicos.\nPara videos de membresía, selecciona tu navegador (Chrome/Edge/Firefox) o carga un archivo cookies.txt.\n\n¿Continuar sin cookies?',
      true,
    );
    if (!proceed) return;
  }

  isDownloading = true;
  downloadBtn.disabled = true;
  concurrentSelect.disabled = true;
  queueList.innerHTML = '';
  items = urls.map((url) => {
    const item: QueueItem = {
      url,
      label: getVideoId(url),
      status: 'pending',
      percent: 0,
      speed: '',
      eta: '',
      el: null!,
    };
    item.el = createItemEl(item);
    queueList.appendChild(item.el);
    return item;
  });

  queueSection.style.display = '';
  queueBar.style.width = '0%';
  updateOverall();

  await processQueue(cookieMode);

  isDownloading = false;
  downloadBtn.disabled = false;
  concurrentSelect.disabled = false;
  downloadBtn.innerHTML = `${DOWNLOAD_ICON} DESCARGAR VIDEOS`;

  const visible = items.filter((i) => i.status !== 'removed');
  const errors = visible.filter((i) => i.status === 'error' || i.status === 'cancelled');
  const done = visible.filter((i) => i.status === 'done');

  if (visible.length === 0) return;

  if (errors.length === 0) {
    await showModal(
      'Descarga completada',
      done.length === 1
        ? 'El video se ha descargado correctamente.'
        : `${done.length} videos descargados correctamente.`,
    );
  } else if (done.length > 0) {
    await showModal(
      'Descarga parcial',
      `${done.length} de ${visible.length} videos descargados.\n${errors.length} errores.`,
    );
  } else {
    await showModal('Error', `Todos los ${errors.length} videos fallaron.`);
  }
}

async function handleRetry(): Promise<void> {
  const failed = items.filter((i) => i.status === 'error' || i.status === 'cancelled');
  if (failed.length === 0) return;

  for (const item of failed) {
    item.status = 'pending';
    item.percent = 0;
    item.speed = '';
    item.eta = '';
    item.error = undefined;
    const nameEl = item.el.querySelector('.qi-name')!;
    nameEl.innerHTML = item.label;
    renderItem(item);
  }

  if (isDownloading) {
    updateOverall();
    tryNextFn?.();
    return;
  }

  const cookieMode = getCookieMode();

  isDownloading = true;
  downloadBtn.disabled = true;
  concurrentSelect.disabled = true;
  updateOverall();

  await processQueue(cookieMode);

  isDownloading = false;
  downloadBtn.disabled = false;
  concurrentSelect.disabled = false;
  downloadBtn.innerHTML = `${DOWNLOAD_ICON} DESCARGAR VIDEOS`;
  updateOverall();

  const visible = items.filter((i) => i.status !== 'removed');
  const errors = visible.filter((i) => i.status === 'error' || i.status === 'cancelled');
  const done = visible.filter((i) => i.status === 'done');

  if (errors.length === 0) {
    await showModal('Reintento completado', `${done.length} videos descargados correctamente.`);
  } else if (errors.length < failed.length) {
    await showModal(
      'Reintento parcial',
      `${failed.length - errors.length} de ${failed.length} recuperados.\n${errors.length} siguen con error.`,
    );
  } else {
    await showModal('Error', `Los ${errors.length} videos siguen fallando.`);
  }
}

export function initDownloadPanel(): void {
  downloadBtn.addEventListener('click', handleDownload);
  retryBtn.addEventListener('click', handleRetry);
  reloadCookiesBtn.addEventListener('click', async () => {
    const result = await loadCookies();
    if (result.status !== 'cancelled') {
      updateCookieStatus(result);
    }
  });
  urlInput.addEventListener('input', updateUrlCount);
  onProgress(handleProgress);
}
