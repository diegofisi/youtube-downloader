import { I, esc } from '../../../app/icons';
import { bus } from '../../../core/bus/event-bus';
import { showToast } from '../../../shared/ui/toast';
import { getHistory, removeHistoryItem, clearHistory, openHistoryFolder } from '../library.api';
import { openDownloadsFolder } from '../../settings/settings.api';
import type { LibraryEntry } from '../library.types';

let entries: LibraryEntry[] = [];
const $ = (id: string) => document.getElementById(id)!;

function fmtDate(secs: number): string {
  try {
    return new Date(secs * 1000).toLocaleString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}
const GRADS = ['linear-gradient(135deg,#3a2d6b,#c2456b)', 'linear-gradient(135deg,#1f6b52,#2b3b4d)', 'linear-gradient(135deg,#6b1f4d,#3a2233)'];
function grad(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffff;
  return GRADS[h % GRADS.length];
}

function render(): void {
  const q = ($('library-search') as HTMLInputElement).value.trim().toLowerCase();
  const list = q ? entries.filter((e) => e.title.toLowerCase().includes(q) || e.url.toLowerCase().includes(q)) : entries;
  $('library-empty').hidden = list.length > 0;
  $('library-count').textContent = `${list.length} elemento${list.length === 1 ? '' : 's'}`;
  $('library-list').innerHTML = list
    .map(
      (e) => `<div data-id="${esc(e.id)}" style="display:flex;align-items:center;gap:13px;padding:11px;background:var(--panel);border:1px solid var(--border);border-radius:13px">
      <div style="position:relative;width:92px;height:52px;flex:none;border-radius:8px;overflow:hidden;background:${grad(e.id)}"><div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center">${I.play20}</div></div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:13.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(e.title)}</div>
        <div style="font-size:12px;color:var(--text2);margin-top:2px">${esc(fmtDate(e.date))}</div>
        <div style="font-size:11px;color:var(--text3);margin-top:3px;font-family:'JetBrains Mono',monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(e.folder)}</div>
      </div>
      <div style="text-align:right;flex:none;margin-right:4px">
        <span style="display:inline-flex;align-items:center;font-size:11px;font-weight:600;padding:2px 8px;border-radius:7px;color:var(--accent);background:var(--accentSoft)">${esc(e.format)}</span>
      </div>
      <div style="display:flex;align-items:center;gap:4px;flex:none">
        <button class="lib-open" title="Abrir carpeta" style="width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;color:var(--text2);border:1px solid var(--border)">${I.folder}</button>
        <button class="lib-del" title="Quitar" style="width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;color:var(--danger);border:1px solid var(--border)">${I.trash}</button>
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
      row.querySelector('.lib-del')?.addEventListener('click', async () => {
        await removeHistoryItem(id);
        entries = entries.filter((x) => x.id !== id);
        render();
      });
    });
}

async function refresh(): Promise<void> {
  entries = await getHistory();
  render();
}

export function initLibrary(): void {
  bus.on('download:completed', () => {
    refresh();
  });
  bus.on('nav:changed', ({ view }) => {
    if (view === 'biblioteca') refresh();
  });
  $('library-search').addEventListener('input', render);
  $('btn-open-downloads').addEventListener('click', () => openDownloadsFolder());
  $('btn-clear-history').addEventListener('click', async () => {
    await clearHistory();
    entries = [];
    render();
    showToast('Historial vaciado', '', 'info');
  });
  refresh();
}
