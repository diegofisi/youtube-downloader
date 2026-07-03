import { I } from '../../../shared/ui/icons';
import { esc } from '../../../shared/lib/html';
import { t } from '../../../core/i18n';
import { $ } from '../../../shared/ui/dom';
import { fmtDuration, fmtSize } from '../../../shared/lib/format';
import { gradFor } from '../../../shared/ui/gradients';
import type { AnalyzedEntry, VideoMeta, PlaylistMeta } from '../../preview';
import { Q_LABEL, effectiveOpts, fmtDescription, opts, overrides, sizeMB } from '../opts-model';

// Analysis preview view: video cards, playlist groups, toolbar and summary. Preview state lives
// here (its heaviest consumers); orchestrator/modal use exported accessors, keeping deps one-way.

// ---------- preview state ----------
let entries: AnalyzedEntry[] = [];
export const sel = new Set<string>();
let onlyDownloadable = false;
const expanded: Record<string, boolean> = {};
let downloadedSet = new Set<string>();

export function setEntries(next: AnalyzedEntry[]): void {
  entries = next;
}
export function hasEntries(): boolean {
  return entries.length > 0;
}
export function setDownloadedSet(next: Set<string>): void {
  downloadedSet = next;
}
export function markDownloaded(url: string, videoId?: string | null): void {
  downloadedSet.add(url);
  if (videoId) downloadedSet.add(videoId);
}
export function toggleOnlyDownloadable(): void {
  onlyDownloadable = !onlyDownloadable;
}

// The per-video options modal opens from these cards but also repaints the preview on close;
// to avoid an import cycle the handler is injected (wired by descargar.ts in init).
let onVideoOptsClick: (url: string) => void = () => {};
export function setOnVideoOptsClick(fn: (url: string) => void): void {
  onVideoOptsClick = fn;
}

// ---------- helpers ----------
export type Status = 'ok' | 'members' | 'downloaded' | 'private' | 'region' | 'error';
export function statusOf(v: VideoMeta): Status {
  if (downloadedSet.has(v.id) || downloadedSet.has(v.url)) return 'downloaded';
  const a = v.availability;
  if (!a) return 'ok';
  if (a.startsWith('error')) return 'error';
  if (a === 'private') return 'private';
  if (a === 'subscriber_only' || a === 'premium_only' || a === 'needs_auth') return 'members';
  if (a.includes('region')) return 'region';
  return 'ok';
}
export const STATUS_META: Record<Status, { readonly label: string; color: string; downloadable: boolean }> = {
  ok: {
    get label() {
      return t('Descargable', 'Downloadable');
    },
    color: 'var(--success)',
    downloadable: true,
  },
  members: {
    get label() {
      return t('De miembros · requiere sesión', 'Members-only · requires session');
    },
    color: 'var(--warn)',
    downloadable: true,
  },
  downloaded: {
    get label() {
      return t('Ya descargado', 'Already downloaded');
    },
    color: 'var(--info)',
    downloadable: true,
  },
  private: {
    get label() {
      return t('Privado · no disponible', 'Private · not available');
    },
    color: 'var(--text3)',
    downloadable: false,
  },
  region: {
    get label() {
      return t('Bloqueado por región', 'Region-blocked');
    },
    color: 'var(--warn)',
    downloadable: false,
  },
  error: {
    get label() {
      return t('No disponible', 'Not available');
    },
    color: 'var(--danger)',
    downloadable: false,
  },
};

// ---------- flatten videos ----------
export function allVideos(): VideoMeta[] {
  const out: VideoMeta[] = [];
  const seenIds = new Set<string>();
  for (const e of entries) {
    const vids = e.is_playlist ? (e as PlaylistMeta).entries : [e as VideoMeta];
    for (const v of vids) out.push({ ...v, _dup: seenIds.has(v.id) } as VideoMeta & { _dup: boolean });
    for (const v of vids) seenIds.add(v.id);
  }
  return out as VideoMeta[];
}

// ---------- render preview ----------
function checkBox(on: boolean): string {
  return `<button class="pv-toggle" style="width:22px;height:22px;flex:none;border-radius:7px;display:flex;align-items:center;justify-content:center;border:1.8px solid ${
    on ? 'var(--accent)' : 'var(--border2)'
  };background:${on ? 'var(--accent)' : 'transparent'};color:var(--accentText)">${on ? I.check : ''}</button>`;
}
function badge(color: string, label: string): string {
  return `<span style="display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:600;padding:3px 8px;border-radius:7px;color:${color};background:color-mix(in srgb, ${color} 14%, transparent)"><span style="width:5px;height:5px;border-radius:50%;background:currentColor"></span>${label}</span>`;
}
function thumb(v: VideoMeta, w: number, h: number): string {
  const g = gradFor(v.id || v.url);
  const inner = v.thumbnail
    ? `<img src="${esc(v.thumbnail)}" loading="lazy" style="width:100%;height:100%;object-fit:cover" alt="">`
    : `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;opacity:.9">${I.play20}</div>`;
  const dur = v.duration
    ? `<span style="position:absolute;bottom:5px;right:5px;background:rgba(0,0,0,.78);color:#fff;font-size:10.5px;font-weight:600;padding:1.5px 5px;border-radius:5px;font-family:'JetBrains Mono',monospace">${fmtDuration(v.duration)}</span>`
    : '';
  return `<div style="position:relative;width:${w}px;height:${h}px;flex:none;border-radius:9px;overflow:hidden;background:${g}">${inner}${dur}</div>`;
}
function optsBtn(url: string): string {
  const has = !!overrides[url];
  return `<button class="pv-opts" data-url="${esc(url)}" title="${t('Opciones de este video', 'Options for this video')}" style="width:28px;height:28px;flex:none;border-radius:8px;display:flex;align-items:center;justify-content:center;border:1px solid ${
    has ? 'var(--accent)' : 'var(--border2)'
  };color:${has ? 'var(--accent)' : 'var(--text2)'};background:${has ? 'var(--accentSoft)' : 'transparent'}">${I.settings}</button>`;
}
function videoCard(v: VideoMeta): string {
  const st = statusOf(v);
  const meta = STATUS_META[st];
  const dup = (v as VideoMeta & { _dup?: boolean })._dup;
  const on = sel.has(v.url);
  const dim = !meta.downloadable ? ';opacity:.5' : dup ? ';opacity:.64' : '';
  const color = dup ? 'var(--text3)' : meta.color;
  const label = dup ? t('Duplicado', 'Duplicate') : meta.label;
  const ov = overrides[v.url];
  // Effective options: globals + partial override (avoids "undefined" when
  // the override only changes some fields).
  const eff = effectiveOpts(v.url);
  const ovLabel = ov
    ? `<span style="display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:600;color:var(--accent);background:var(--accentSoft);padding:2px 7px;border-radius:6px" title="${t('Opciones personalizadas de este video', 'Custom options for this video')}">${esc(fmtDescription(eff))}</span>`
    : '';
  const modeChip = eff.mode === 'audio' ? 'AUDIO' : 'VIDEO';
  return `<div class="pv-card" data-url="${esc(v.url)}" style="display:flex;align-items:center;gap:13px;padding:11px;background:var(--panel);border:1px solid ${
    on ? 'var(--accent)' : 'var(--border)'
  };border-radius:14px;transition:border-color .15s${dim}">
    ${checkBox(on)}
    ${thumb(v, 120, 68)}
    <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:4px">
      <div style="font-weight:600;font-size:13.5px;line-height:1.3;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(v.title)}</div>
      <div style="display:flex;align-items:center;gap:7px;min-width:0">
        <span style="font-size:12px;color:var(--text2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(v.channel)}</span>
      </div>
      <div style="display:flex;align-items:center;gap:8px;margin-top:1px">${badge(color, label)}<span style="font-size:11.5px;color:var(--text3);font-family:'JetBrains Mono',monospace">${fmtSize(sizeMB(v))}</span>${ovLabel}</div>
    </div>
    <div style="display:flex;flex-direction:column;align-items:flex-end;gap:7px;align-self:flex-start;flex:none">
      <span style="font-size:9.5px;font-weight:700;letter-spacing:.5px;color:${eff.mode === 'audio' ? 'var(--success)' : 'var(--text3)'};background:${eff.mode === 'audio' ? 'var(--successSoft)' : 'var(--hover)'};padding:3px 7px;border-radius:5px">${modeChip}</span>
      ${optsBtn(v.url)}
    </div>
  </div>`;
}
function playlistGroup(p: PlaylistMeta): string {
  const isExp = expanded[p.id] !== false;
  let kids = p.entries;
  if (onlyDownloadable) kids = kids.filter((v) => STATUS_META[statusOf(v)].downloadable);
  const selectable = p.entries.filter((v) => STATUS_META[statusOf(v)].downloadable);
  const nSel = selectable.filter((v) => sel.has(v.url)).length;
  const allSel = selectable.length > 0 && nSel === selectable.length;
  const childRows = kids
    .map((v) => {
      const st = statusOf(v);
      const meta = STATUS_META[st];
      const on = sel.has(v.url);
      const dim = !meta.downloadable ? ';opacity:.5' : '';
      return `<div class="pv-card" data-url="${esc(v.url)}" style="display:flex;align-items:center;gap:11px;padding:8px 9px;background:var(--bg);border:1px solid ${
        on ? 'var(--accent)' : 'transparent'
      };border-radius:10px${dim}">
        ${checkBox(on)}
        ${thumb(v, 92, 52)}
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:12.5px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(v.title)}</div>
          <div style="display:flex;align-items:center;gap:7px;margin-top:5px">${badge(meta.color, meta.label)}<span style="font-size:11px;color:var(--text3);font-family:'JetBrains Mono',monospace">${fmtSize(sizeMB(v))}</span></div>
        </div>
        ${optsBtn(v.url)}
      </div>`;
    })
    .join('');
  return `<div style="background:var(--panel);border:1px solid var(--border);border-radius:14px;overflow:hidden">
    <div style="display:flex;align-items:center;gap:12px;padding:12px 13px">
      <button class="pv-group-toggle" data-pl="${esc(p.id)}" style="width:22px;height:22px;flex:none;border-radius:7px;display:flex;align-items:center;justify-content:center;border:1.8px solid ${
        allSel ? 'var(--accent)' : 'var(--border2)'
      };background:${allSel ? 'var(--accent)' : 'transparent'};color:var(--accentText)">${allSel ? I.check : ''}</button>
      <div style="position:relative;width:56px;height:48px;flex:none">
        <div style="position:absolute;top:0;left:6px;right:6px;height:6px;border-radius:4px 4px 0 0;background:${gradFor(p.id)};opacity:.45"></div>
        <div style="position:absolute;top:4px;left:2px;right:2px;bottom:0;border-radius:8px;overflow:hidden;background:${gradFor(p.id)};display:flex;align-items:center;justify-content:center;opacity:.92">${I.play20}</div>
        <span style="position:absolute;right:3px;bottom:3px;background:rgba(0,0,0,.8);color:#fff;font-size:9.5px;font-weight:700;padding:1px 5px;border-radius:4px;font-family:'JetBrains Mono',monospace">${p.count}</span>
      </div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:7px;margin-bottom:3px">
          <span style="font-size:9.5px;font-weight:700;letter-spacing:.5px;color:var(--accent);background:var(--accentSoft);padding:2px 7px;border-radius:5px">PLAYLIST</span>
          <span style="font-weight:600;font-size:13.5px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.title)}</span>
        </div>
        <div style="font-size:12px;color:var(--text2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.channel)} · ${t(`${p.count} videos · ${nSel} de ${selectable.length} elegidos`, `${p.count} videos · ${nSel} of ${selectable.length} selected`)}</div>
      </div>
      <button class="pv-expand hov" data-pl="${esc(p.id)}" style="display:flex;align-items:center;gap:5px;height:30px;padding:0 11px;flex:none;border-radius:8px;color:var(--text2);font-size:12px;font-weight:600">${isExp ? t('Ocultar', 'Hide') : t('Ver', 'View')}<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="${isExp ? 'm6 9 6 6 6-6' : 'm9 6 6 6-6 6'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
    </div>
    ${isExp ? `<div style="display:flex;flex-direction:column;gap:6px;padding:9px;border-top:1px solid var(--border)">${childRows}</div>` : ''}
  </div>`;
}

export function renderPreview(): void {
  const listEl = $('preview-list');
  const emptyEl = $('preview-empty');
  if (entries.length === 0) {
    listEl.innerHTML = '';
    emptyEl.hidden = false;
    return;
  }
  emptyEl.hidden = true;
  const groups = entries
    .map((e) => {
      if (e.is_playlist) return playlistGroup(e as PlaylistMeta);
      const v = e as VideoMeta & { _dup?: boolean };
      if (onlyDownloadable && !STATUS_META[statusOf(v)].downloadable) return '';
      return videoCard(v);
    })
    .filter(Boolean)
    .join('');
  listEl.innerHTML = `<div style="display:flex;flex-direction:column;gap:10px">${groups}</div>`;

  const vids = allVideos();
  const byUrl = new Map<string, VideoMeta>();
  for (const v of vids) if (!byUrl.has(v.url)) byUrl.set(v.url, v);

  listEl.querySelectorAll<HTMLElement>('.pv-card').forEach((card) => {
    const url = card.dataset.url!;
    const v = byUrl.get(url);
    card.querySelector('.pv-toggle')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (v && !STATUS_META[statusOf(v)].downloadable) return;
      if (sel.has(url)) sel.delete(url);
      else sel.add(url);
      renderPreview();
    });
  });
  listEl.querySelectorAll<HTMLElement>('.pv-opts').forEach((b) =>
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      onVideoOptsClick(b.dataset.url!);
    }),
  );
  listEl.querySelectorAll<HTMLElement>('.pv-expand').forEach((b) =>
    b.addEventListener('click', () => {
      const id = b.dataset.pl!;
      expanded[id] = expanded[id] === false;
      renderPreview();
    }),
  );
  listEl.querySelectorAll<HTMLElement>('.pv-group-toggle').forEach((b) =>
    b.addEventListener('click', () => {
      const p = entries.find((e) => e.is_playlist && (e as PlaylistMeta).id === b.dataset.pl) as
        PlaylistMeta | undefined;
      if (!p) return;
      const selectable = p.entries.filter((v) => STATUS_META[statusOf(v)].downloadable);
      const allSel = selectable.length > 0 && selectable.every((v) => sel.has(v.url));
      selectable.forEach((v) => (allSel ? sel.delete(v.url) : sel.add(v.url)));
      renderPreview();
    }),
  );

  // toolbar
  const total = vids.length;
  $('preview-count-label').textContent = `${total} video${total === 1 ? '' : 's'}`; // "video(s)" is the same in both languages
  $('btn-filter-dl').hidden = false;
  $('btn-select-all').hidden = false;
  const selectable = vids.filter((v) => STATUS_META[statusOf(v)].downloadable);
  const allOn = selectable.length > 0 && selectable.every((v) => sel.has(v.url));
  $('btn-select-all').textContent = allOn
    ? t('Quitar selección', 'Clear selection')
    : t('Seleccionar todo', 'Select all');
  $('btn-filter-dl').setAttribute(
    'style',
    `font-size:12px;font-weight:600;padding:6px 11px;border-radius:8px;border:1.5px solid ${
      onlyDownloadable ? 'var(--accent)' : 'var(--border)'
    };background:${onlyDownloadable ? 'var(--accentSoft)' : 'transparent'};color:${onlyDownloadable ? 'var(--accent)' : 'var(--text2)'}`,
  );
  refreshSummary();
}

export function refreshSummary(): void {
  const chosen = allVideos().filter((v) => sel.has(v.url) && STATUS_META[statusOf(v)].downloadable);
  // How many selected videos carry custom options (non-empty override).
  const custom = chosen.filter((v) => overrides[v.url] && Object.keys(overrides[v.url]).length > 0).length;
  $('sel-count').textContent = t(
    `${chosen.length} seleccionados${custom > 0 ? ` · ${custom} personalizado${custom === 1 ? '' : 's'}` : ''}`,
    `${chosen.length} selected${custom > 0 ? ` · ${custom} customized` : ''}`,
  );
  $('options-summary').textContent =
    opts.mode === 'audio'
      ? `${opts.audioFmt} · ${opts.bitrate} kbps`
      : `${Q_LABEL[opts.quality]} · ${opts.container}${opts.mode === 'video' ? t(' · sin audio', ' · no audio') : ''}${opts.subs ? ' · Subs' : ''}`;
  const estMB = chosen.reduce((a, v) => a + sizeMB(v), 0);
  $('est-total').textContent = estMB ? fmtSize(estMB) : '—';
  $('download-label').textContent = `${t('Descargar', 'Download')} ${chosen.length || ''}`.trim();
}
