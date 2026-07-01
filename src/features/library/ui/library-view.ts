import {
  getHistory,
  addHistory,
  removeHistoryItem,
  clearHistory,
  openHistoryFolder,
} from '../library.api';
import type { LibraryEntry } from '../library.types';
import { bus } from '../../../core/bus/event-bus';
import { showToast } from '../../../shared/ui/toast';

const listEl = document.getElementById('library-list') as HTMLElement;
const emptyEl = document.getElementById('library-empty') as HTMLElement;
const searchEl = document.getElementById('library-search') as HTMLInputElement;
const clearBtn = document.getElementById('btn-clear-history') as HTMLButtonElement;

let entries: LibraryEntry[] = [];

function esc(s: string): string {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function fmtDate(secs: number): string {
  try {
    return new Date(secs * 1000).toLocaleString('es', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function render(): void {
  const q = searchEl.value.trim().toLowerCase();
  const filtered = q
    ? entries.filter((e) => e.title.toLowerCase().includes(q) || e.url.toLowerCase().includes(q))
    : entries;

  emptyEl.style.display = filtered.length === 0 ? '' : 'none';
  listEl.innerHTML = filtered
    .map(
      (e) => `
      <div class="lib-item" data-id="${esc(e.id)}">
        <div class="lib-info">
          <div class="lib-title">${esc(e.title)}</div>
          <div class="lib-meta">${esc(e.format)} · ${fmtDate(e.date)}</div>
        </div>
        <button class="lib-btn" data-action="open" title="Abrir carpeta">Abrir</button>
        <button class="lib-btn lib-btn--danger" data-action="remove" title="Quitar">✕</button>
      </div>`,
    )
    .join('');
}

async function refresh(): Promise<void> {
  entries = await getHistory();
  render();
}

export function initLibrary(): void {
  // Registrar en el historial cuando una descarga termina.
  bus.on('download:completed', ({ url, title, format }) => {
    addHistory(url, title, format).then((entry) => {
      entries.unshift(entry);
      render();
    });
  });

  // Refrescar al entrar a la sección.
  bus.on('nav:changed', ({ view }) => {
    if (view === 'biblioteca') refresh();
  });

  searchEl.addEventListener('input', render);

  clearBtn.addEventListener('click', async () => {
    await clearHistory();
    entries = [];
    render();
    showToast('Historial vaciado', 'info');
  });

  listEl.addEventListener('click', async (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.lib-btn');
    if (!btn) return;
    const item = btn.closest<HTMLElement>('.lib-item')!;
    const id = item.dataset.id!;
    const entry = entries.find((x) => x.id === id);
    if (!entry) return;

    if (btn.dataset.action === 'open') {
      openHistoryFolder(entry.folder);
    } else if (btn.dataset.action === 'remove') {
      await removeHistoryItem(id);
      entries = entries.filter((x) => x.id !== id);
      render();
    }
  });

  refresh();
}
