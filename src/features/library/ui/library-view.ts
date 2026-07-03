import { I, esc } from '../../../app/icons';
import { t, getLang } from '../../../core/i18n';
import { bus } from '../../../core/bus/event-bus';
import { showToast } from '../../../shared/ui/toast';
import { showModal } from '../../../shared/ui/modal';
import { getHistory, removeHistoryItem, clearHistory, openHistoryFolder } from '../library.api';
import * as libraryApi from '../library.api';
import { openDownloadsFolder } from '../../settings/settings.api';
import type { LibraryEntry } from '../library.types';

/** Contratos en publicación (otro agente): cuando library.api exporte
 *  deleteHistoryFile y LibraryEntry tenga filePath, estos casts sobran. */
type DeleteFileResult = 'trash' | 'permanent' | 'no_file';
const deleteHistoryFile = (id: string): Promise<DeleteFileResult> =>
  (libraryApi as unknown as { deleteHistoryFile: (id: string) => Promise<DeleteFileResult> }).deleteHistoryFile(id);
const filePathOf = (e: LibraryEntry): string | undefined => (e as { filePath?: string }).filePath;

let entries: LibraryEntry[] = [];
const PAGE_SIZE = 50;
let visibleCount = PAGE_SIZE;
const $ = (id: string) => document.getElementById(id)!;

function fmtDate(secs: number): string {
  try {
    return new Date(secs * 1000).toLocaleString(getLang(), { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}
function fmtDuration(s?: number): string {
  if (!s) return '';
  const sec = Math.floor(s);
  const m = Math.floor(sec / 60);
  const ss = sec % 60;
  const h = Math.floor(m / 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m % 60)}:${pad(ss)}` : `${m}:${pad(ss)}`;
}
const GRADS = ['linear-gradient(135deg,#3a2d6b,#c2456b)', 'linear-gradient(135deg,#1f6b52,#2b3b4d)', 'linear-gradient(135deg,#6b1f4d,#3a2233)'];
function grad(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffff;
  return GRADS[h % GRADS.length];
}

// ---------- mini-menú del tacho ----------
let openMenu: HTMLElement | null = null;
let openMenuAnchor: HTMLElement | null = null;
let menuGlobalsBound = false;

function closeDelMenu(): void {
  openMenu?.remove();
  openMenu = null;
  openMenuAnchor = null;
}

function bindMenuGlobals(): void {
  if (menuGlobalsBound) return;
  menuGlobalsBound = true;
  document.addEventListener('click', (ev) => {
    if (openMenu && !openMenu.contains(ev.target as Node)) closeDelMenu();
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') closeDelMenu();
  });
}

function menuItem(icon: string, label: string, color: string, onPick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.style.cssText = `display:flex;align-items:center;gap:9px;width:100%;padding:8px 10px;border-radius:7px;background:none;border:none;cursor:pointer;text-align:left;font-size:12.5px;font-weight:500;color:${color};font-family:inherit`;
  b.innerHTML = `<span style="display:flex;flex:none">${icon}</span><span>${esc(label)}</span>`;
  b.addEventListener('mouseenter', () => (b.style.background = 'var(--hover)'));
  b.addEventListener('mouseleave', () => (b.style.background = 'none'));
  b.addEventListener('click', (ev) => {
    ev.stopPropagation();
    closeDelMenu();
    onPick();
  });
  return b;
}

function openDelMenu(anchor: HTMLElement, e: LibraryEntry): void {
  closeDelMenu();
  const menu = document.createElement('div');
  menu.style.cssText =
    'position:fixed;z-index:900;min-width:196px;padding:5px;display:flex;flex-direction:column;gap:1px;background:var(--panel);border:1px solid var(--border);border-radius:11px;box-shadow:0 10px 28px rgba(0,0,0,.4)';
  menu.appendChild(
    menuItem(I.x, t('Quitar de la lista', 'Remove from list'), 'var(--text)', async () => {
      await removeHistoryItem(e.id);
      entries = entries.filter((x) => x.id !== e.id);
      render();
    }),
  );
  if (filePathOf(e)) {
    menu.appendChild(menuItem(I.trash, t('Eliminar archivo', 'Delete file'), 'var(--danger)', () => deleteEntryFile(e)));
  }
  document.body.appendChild(menu);
  const r = anchor.getBoundingClientRect();
  const mw = menu.offsetWidth;
  const mh = menu.offsetHeight;
  menu.style.left = `${Math.max(8, Math.min(r.right - mw, window.innerWidth - mw - 8))}px`;
  menu.style.top =
    r.bottom + 6 + mh > window.innerHeight - 8 ? `${Math.max(8, r.top - mh - 6)}px` : `${r.bottom + 6}px`;
  openMenu = menu;
  openMenuAnchor = anchor;
}

async function deleteEntryFile(e: LibraryEntry): Promise<void> {
  const ok = await showModal(
    t('Eliminar archivo', 'Delete file'),
    t(
      'Se enviará a la papelera si es posible; si no, se eliminará permanentemente.\n\n¿Continuar?',
      'The file will be moved to the Recycle Bin if possible; otherwise it will be permanently deleted.\n\nContinue?',
    ),
    true,
  );
  if (!ok) return;
  try {
    const result = await deleteHistoryFile(e.id);
    if (result === 'trash') showToast(t('Archivo enviado a la papelera', 'File moved to Recycle Bin'), '', 'done');
    else if (result === 'permanent')
      showToast(
        t(
          'Archivo eliminado permanentemente (la unidad no tiene papelera)',
          'File permanently deleted (the drive has no Recycle Bin)',
        ),
        '',
        'warn',
      );
    else
      showToast(
        t('El archivo ya no existía; se quitó de la lista', 'The file no longer existed; it was removed from the list'),
        '',
        'info',
      );
    entries = entries.filter((x) => x.id !== e.id);
    render();
  } catch {
    showToast(t('No se pudo eliminar el archivo', 'Could not delete the file'), '', 'error');
  }
}

function render(): void {
  closeDelMenu();
  const q = ($('library-search') as HTMLInputElement).value.trim().toLowerCase();
  const list = q ? entries.filter((e) => e.title.toLowerCase().includes(q) || e.url.toLowerCase().includes(q)) : entries;
  const shown = list.slice(0, visibleCount);
  const hasMore = list.length > shown.length;
  $('library-empty').hidden = list.length > 0;
  $('library-count').textContent = hasMore
    ? t(`${shown.length} de ${list.length} elementos`, `${shown.length} of ${list.length} items`)
    : t(
        `${list.length} elemento${list.length === 1 ? '' : 's'}`,
        `${list.length} item${list.length === 1 ? '' : 's'}`,
      );
  const moreWrap = $('library-more-wrap');
  moreWrap.hidden = !hasMore;
  moreWrap.style.display = hasMore ? 'flex' : 'none';
  $('library-list').innerHTML = shown
    .map(
      (e) => `<div data-id="${esc(e.id)}" style="display:flex;align-items:center;gap:13px;padding:11px;background:var(--panel);border:1px solid var(--border);border-radius:13px">
      <div style="position:relative;width:92px;height:52px;flex:none;border-radius:8px;overflow:hidden;background:${grad(e.id)}">
        ${e.thumbnail ? `<img src="${esc(e.thumbnail)}" loading="lazy" style="width:100%;height:100%;object-fit:cover" alt="">` : `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center">${I.play20}</div>`}
        ${e.duration ? `<span style="position:absolute;bottom:3px;right:3px;background:rgba(0,0,0,.78);color:#fff;font-size:9.5px;font-weight:600;padding:1px 4px;border-radius:4px;font-family:'JetBrains Mono',monospace">${fmtDuration(e.duration)}</span>` : ''}
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:13.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(e.title)}</div>
        <div style="font-size:12px;color:var(--text2);margin-top:2px">${esc(fmtDate(e.date))}</div>
        <div style="font-size:11px;color:var(--text3);margin-top:3px;font-family:'JetBrains Mono',monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(e.folder)}</div>
      </div>
      <div style="text-align:right;flex:none;margin-right:4px">
        <span style="display:inline-flex;align-items:center;font-size:11px;font-weight:600;padding:2px 8px;border-radius:7px;color:var(--accent);background:var(--accentSoft)">${esc(e.format)}</span>
      </div>
      <div style="display:flex;align-items:center;gap:4px;flex:none">
        <button class="lib-open" title="${esc(t('Abrir carpeta', 'Open folder'))}" style="width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;color:var(--text2);border:1px solid var(--border)">${I.folder}</button>
        <button class="lib-del" title="${esc(t('Quitar o eliminar', 'Remove or delete'))}" style="width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;color:var(--danger);border:1px solid var(--border)">${I.trash}</button>
      </div>
    </div>`,
    )
    .join('');

  $('library-list')
    .querySelectorAll<HTMLElement>('[data-id]')
    .forEach((row) => {
      const id = row.dataset.id!;
      const e = entries.find((x) => x.id === id)!;
      row.querySelector('.lib-open')?.addEventListener('click', () => openHistoryFolder(e.folder));
      row.querySelector<HTMLElement>('.lib-del')?.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const btn = ev.currentTarget as HTMLElement;
        // Segundo click en el mismo tacho: cierra el menú (toggle).
        if (openMenuAnchor === btn) {
          closeDelMenu();
          return;
        }
        openDelMenu(btn, e);
      });
    });
}

async function refresh(): Promise<void> {
  entries = await getHistory();
  visibleCount = PAGE_SIZE;
  render();
}

export function initLibrary(): void {
  bindMenuGlobals();
  // El historial lo escribe la cola (queue.ts) al completar, con videoId, miniatura
  // y duración; aquí solo refrescamos la vista. (Antes ambos escribían → duplicados.)
  bus.on('download:completed', () => {
    refresh();
  });
  bus.on('nav:changed', ({ view }) => {
    if (view === 'biblioteca') refresh();
  });
  $('library-search').addEventListener('input', () => {
    visibleCount = PAGE_SIZE;
    render();
  });
  $('library-more').addEventListener('click', () => {
    visibleCount += PAGE_SIZE;
    render();
  });
  $('btn-open-downloads').addEventListener('click', () => openDownloadsFolder());
  $('btn-clear-history').addEventListener('click', async () => {
    if (
      !(await showModal(
        t('Vaciar historial', 'Clear history'),
        t(
          'Se limpiará el historial de descargas. Los archivos descargados NO se borran de tu equipo.\n\n¿Continuar?',
          'This will clear your download history. The downloaded files will NOT be deleted from your computer.\n\nContinue?',
        ),
        true,
      ))
    )
      return;
    await clearHistory();
    entries = [];
    visibleCount = PAGE_SIZE;
    render();
    showToast(t('Historial vaciado', 'History cleared'), '', 'info');
  });
  refresh();
}
