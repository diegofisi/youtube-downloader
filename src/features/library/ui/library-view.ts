import { I } from '../../../shared/ui/icons';
import { esc } from '../../../shared/lib/html';
import { t } from '../../../core/i18n';
import { bus } from '../../../core/bus/event-bus';
import { showToast } from '../../../shared/ui/toast';
import { showModal } from '../../../shared/ui/modal';
import { $ } from '../../../shared/ui/dom';
import { fmtDate, fmtDuration } from '../../../shared/lib/format';
import { gradFor } from '../../../shared/ui/gradients';
import { openAnchoredMenu, closeAnchoredMenu, type AnchoredMenuItem } from '../../../shared/ui/anchored-menu';
import { getHistory, removeHistoryItem, clearHistory, openHistoryFolder, deleteHistoryFile } from '../library.api';
import { openDownloadsFolder } from '../../settings';
import type { LibraryEntry } from '../library.types';

let entries: LibraryEntry[] = [];
const PAGE_SIZE = 50;
let visibleCount = PAGE_SIZE;

// ---------- mini-menú del tacho ----------
function openDelMenu(anchor: HTMLElement, e: LibraryEntry): void {
  const items: AnchoredMenuItem[] = [
    {
      icon: I.x,
      label: t('Quitar de la lista', 'Remove from list'),
      color: 'var(--text)',
      onPick: async () => {
        try {
          await removeHistoryItem(e.id);
          entries = entries.filter((x) => x.id !== e.id);
          render();
        } catch {
          showToast(t('No se pudo quitar del historial', 'Could not remove from history'), '', 'error');
        }
      },
    },
  ];
  if (e.filePath) {
    items.push({ icon: I.trash, label: t('Eliminar archivo', 'Delete file'), color: 'var(--danger)', onPick: () => deleteEntryFile(e) });
  }
  openAnchoredMenu(anchor, items);
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
  closeAnchoredMenu();
  const q = $<HTMLInputElement>('library-search').value.trim().toLowerCase();
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
      <div style="position:relative;width:92px;height:52px;flex:none;border-radius:8px;overflow:hidden;background:${gradFor(e.id)}">
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
      row.querySelector('.lib-open')?.addEventListener('click', () =>
        openHistoryFolder(e.folder).catch(() => showToast(t('No se pudo abrir la carpeta', 'Could not open the folder'), '', 'error')),
      );
      row.querySelector<HTMLElement>('.lib-del')?.addEventListener('click', (ev) => {
        ev.stopPropagation();
        // Segundo click en el mismo tacho: el menú anclado hace toggle solo.
        openDelMenu(ev.currentTarget as HTMLElement, e);
      });
    });
}

async function refresh(): Promise<void> {
  entries = await getHistory();
  visibleCount = PAGE_SIZE;
  render();
}

export function initLibrary(): void {
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
  $('btn-open-downloads').addEventListener('click', () =>
    openDownloadsFolder().catch(() => showToast(t('No se pudo abrir la carpeta', 'Could not open the folder'), '', 'error')),
  );
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
