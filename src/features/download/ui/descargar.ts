import { I, esc } from '../../../app/icons';
import { bus } from '../../../core/bus/event-bus';
import { router } from '../../../app/shell';
import { showToast } from '../../../shared/ui/toast';
import { analyzeUrls, onPreviewProgress } from '../../preview/preview.api';
import type { AnalyzedEntry, VideoMeta, PlaylistMeta } from '../../preview/preview.types';
import { getCookieMode } from '../../session';
import { changeDownloadFolder, getDownloadFolder } from '../../settings/settings.api';
import { getHistory } from '../../library/library.api';
import { enqueue } from '../../queue';
import type { DownloadOptions } from '../download.types';

// ---------- estado de opciones ----------
interface Opts {
  mode: 'av' | 'video' | 'audio';
  quality: string; // max|4k|1440p|1080p|720p|480p
  container: string; // MP4|MKV|WebM
  audioFmt: string; // MP3|M4A|Opus
  bitrate: string; // 320...
  subs: boolean;
  thumb: boolean;
  template: string;
}
const opts: Opts = {
  mode: 'av',
  quality: 'max',
  container: 'MP4',
  audioFmt: 'MP3',
  bitrate: '320',
  subs: false,
  thumb: true,
  template: '%(title)s [%(id)s]',
};
const overrides: Record<string, Partial<Opts>> = {};

const Q_FACTOR: Record<string, number> = {
  max: 1.55,
  '4k': 2.6,
  '1440p': 1.7,
  '1080p': 1,
  '720p': 0.55,
  '480p': 0.3,
  '360p': 0.18,
  auto: 1,
};
const Q_LABEL: Record<string, string> = {
  max: 'Máxima',
  '4k': '4K',
  '1440p': '1440p',
  '1080p': '1080p',
  '720p': '720p',
  '480p': '480p',
};
const Q_BACKEND: Record<string, string> = {
  max: 'max',
  '4k': '2160',
  '1440p': '1440',
  '1080p': '1080',
  '720p': '720',
  '480p': '480',
};

export function optsToBackend(o: Opts, cookieMode: string): DownloadOptions {
  return {
    mode: o.mode === 'audio' ? 'audio' : o.mode === 'video' ? 'videoonly' : 'video',
    quality: Q_BACKEND[o.quality] ?? 'auto',
    container: o.container.toLowerCase() as DownloadOptions['container'],
    audioFormat: o.audioFmt.toLowerCase() as DownloadOptions['audioFormat'],
    audioBitrate: parseInt(o.bitrate, 10) || 0,
    subtitles: o.subs,
    subLangs: 'es,en',
    embedThumbnail: o.thumb,
    outputTemplate: o.template.trim() || undefined,
    cookieMode,
  };
}
export function fmtDescription(o: Opts): string {
  return o.mode === 'audio' ? `${o.audioFmt} · ${o.bitrate}` : `${Q_LABEL[o.quality]} · ${o.container}`;
}

// ---------- preview state ----------
let entries: AnalyzedEntry[] = [];
const sel = new Set<string>();
let onlyDownloadable = false;
const expanded: Record<string, boolean> = {};
let downloadedSet = new Set<string>();

// ---------- helpers ----------
const GRADS = [
  'linear-gradient(135deg,#3a2d6b,#c2456b)',
  'linear-gradient(135deg,#1f6b52,#2b3b4d)',
  'linear-gradient(135deg,#6b1f4d,#3a2233)',
  'linear-gradient(135deg,#46307a,#a84a6b)',
  'linear-gradient(135deg,#1f4d6b,#33335a)',
];
function gradFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffff;
  return GRADS[h % GRADS.length];
}
function fmtDuration(s?: number): string {
  if (!s) return '';
  const sec = Math.floor(s);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const ss = sec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(ss)}` : `${m}:${pad(ss)}`;
}
function fmtSize(mb: number): string {
  if (!mb) return '—';
  if (mb >= 1024) return `${(mb / 1024).toFixed(mb >= 10240 ? 0 : 1)} GB`;
  return `${Math.round(mb)} MB`;
}
type Status = 'ok' | 'members' | 'downloaded' | 'private' | 'region' | 'error';
function statusOf(v: VideoMeta): Status {
  if (downloadedSet.has(v.id) || downloadedSet.has(v.url)) return 'downloaded';
  const a = v.availability;
  if (!a) return 'ok';
  if (a.startsWith('error')) return 'error';
  if (a === 'private') return 'private';
  if (a === 'subscriber_only' || a === 'premium_only' || a === 'needs_auth') return 'members';
  if (a.includes('region')) return 'region';
  return 'ok';
}
const STATUS_META: Record<Status, { label: string; color: string; downloadable: boolean }> = {
  ok: { label: 'Descargable', color: 'var(--success)', downloadable: true },
  members: { label: 'De miembros · requiere sesión', color: 'var(--warn)', downloadable: true },
  downloaded: { label: 'Ya descargado', color: 'var(--info)', downloadable: true },
  private: { label: 'Privado · no disponible', color: 'var(--text3)', downloadable: false },
  region: { label: 'Bloqueado por región', color: 'var(--warn)', downloadable: false },
  error: { label: 'No disponible', color: 'var(--danger)', downloadable: false },
};
function sizeMB(v: VideoMeta): number {
  const base = v.size_bytes ? v.size_bytes / 1048576 : 0;
  const rel = (Q_FACTOR[opts.quality] ?? 1) / Q_FACTOR.max;
  return base * rel * (opts.mode === 'audio' ? 0.08 : 1);
}

// ---------- flatten videos ----------
function allVideos(): VideoMeta[] {
  const out: VideoMeta[] = [];
  const seenIds = new Set<string>();
  for (const e of entries) {
    const vids = e.is_playlist ? (e as PlaylistMeta).entries : [e as VideoMeta];
    for (const v of vids) out.push({ ...v, _dup: seenIds.has(v.id) } as VideoMeta & { _dup: boolean });
    for (const v of vids) seenIds.add(v.id);
  }
  return out as VideoMeta[];
}

// ---------- DOM refs ----------
const $ = (id: string) => document.getElementById(id)!;

// ---------- render options ----------
const chipStyle = (on: boolean) =>
  `padding:6px 11px;border-radius:8px;font-size:12px;font-weight:600;border:1.5px solid ${
    on ? 'var(--accent)' : 'var(--border)'
  };background:${on ? 'var(--accentSoft)' : 'transparent'};color:${on ? 'var(--accent)' : 'var(--text2)'}`;
const toggleStyle = (on: boolean) =>
  `width:38px;height:22px;flex:none;border-radius:12px;padding:2px;display:flex;background:${
    on ? 'var(--accent)' : 'var(--border2)'
  };justify-content:${on ? 'flex-end' : 'flex-start'};transition:all .18s`;
const knob = '<span style="width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.3)"></span>';

const MODE_DEFS = [
  { id: 'av', title: 'Video + audio', sub: 'La opción más común', icon: I.film, bg: 'var(--infoSoft)', c: 'var(--info)' },
  { id: 'video', title: 'Solo video', sub: 'Sin pista de audio', icon: I.video, bg: 'var(--accentSoft)', c: 'var(--accent)' },
  { id: 'audio', title: 'Solo audio', sub: 'MP3 / M4A / Opus', icon: I.music, bg: 'var(--successSoft)', c: 'var(--success)' },
];

function renderModeCards(): void {
  $('mode-cards').innerHTML = MODE_DEFS.map((m) => {
    const on = opts.mode === m.id;
    return `<button data-mode="${m.id}" style="display:flex;align-items:center;gap:11px;padding:10px;border-radius:12px;border:1.5px solid ${
      on ? 'var(--accent)' : 'var(--border)'
    };background:${on ? 'var(--accentSoft)' : 'transparent'};text-align:left;transition:all .15s;width:100%">
      <span style="width:34px;height:34px;flex:none;border-radius:9px;display:flex;align-items:center;justify-content:center;background:${m.bg};color:${m.c}">${m.icon}</span>
      <span style="flex:1;text-align:left"><span style="display:block;font-weight:600;font-size:13px;color:var(--text)">${m.title}</span><span style="display:block;font-size:11px;color:var(--text2);margin-top:1px">${m.sub}</span></span>
      <span style="width:18px;height:18px;flex:none;border-radius:50%;border:2px solid ${
        on ? 'var(--accent)' : 'var(--border2)'
      };display:flex;align-items:center;justify-content:center">${on ? '<span style="width:9px;height:9px;border-radius:50%;background:var(--accent)"></span>' : ''}</span>
    </button>`;
  }).join('');
  $('mode-cards')
    .querySelectorAll<HTMLElement>('[data-mode]')
    .forEach((b) =>
      b.addEventListener('click', () => {
        opts.mode = b.dataset.mode as Opts['mode'];
        $('video-opts').hidden = opts.mode === 'audio';
        $('audio-opts').hidden = opts.mode !== 'audio';
        renderModeCards();
        refreshSummary();
      }),
    );
}

function renderChips(groupSel: string, list: [string, string][], get: () => string, set: (v: string) => void): void {
  const el = document.querySelector<HTMLElement>(`[data-group="${groupSel}"]`);
  if (!el) return;
  el.innerHTML = list
    .map(([v, l]) => `<button data-val="${v}" style="${chipStyle(v === get())}">${l}</button>`)
    .join('');
  el.querySelectorAll<HTMLElement>('[data-val]').forEach((b) =>
    b.addEventListener('click', () => {
      set(b.dataset.val!);
      renderChips(groupSel, list, get, set);
      if (groupSel === 'quality') renderPreview();
      refreshSummary();
    }),
  );
}

function renderToggle(id: string, get: () => boolean, set: (v: boolean) => void): void {
  const btn = $(id);
  const paint = () => {
    btn.setAttribute('style', toggleStyle(get()));
    btn.innerHTML = knob;
    btn.dataset.on = get() ? '1' : '0';
  };
  paint();
  btn.addEventListener('click', () => {
    set(!get());
    paint();
    refreshSummary();
  });
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
  return `<button class="pv-opts" data-url="${esc(url)}" title="Opciones de este video" style="width:28px;height:28px;flex:none;border-radius:8px;display:flex;align-items:center;justify-content:center;border:1px solid ${
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
  const label = dup ? 'Duplicado' : meta.label;
  const ov = overrides[v.url];
  const ovLabel = ov
    ? `<span style="display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:600;color:var(--accent);background:var(--accentSoft);padding:2px 7px;border-radius:6px">${
        ov.mode === 'audio' ? `${ov.audioFmt} ${ov.bitrate}` : `${Q_LABEL[ov.quality ?? opts.quality]} ${ov.container ?? opts.container}`
      }</span>`
    : '';
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
      <span style="font-size:9.5px;font-weight:700;letter-spacing:.5px;color:var(--text3);background:var(--hover);padding:3px 7px;border-radius:5px">VIDEO</span>
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
        <div style="font-size:12px;color:var(--text2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.channel)} · ${p.count} videos · ${nSel} de ${selectable.length} elegidos</div>
      </div>
      <button class="pv-expand hov" data-pl="${esc(p.id)}" style="display:flex;align-items:center;gap:5px;height:30px;padding:0 11px;flex:none;border-radius:8px;color:var(--text2);font-size:12px;font-weight:600">${isExp ? 'Ocultar' : 'Ver'}<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="${isExp ? 'm6 9 6 6 6-6' : 'm9 6 6 6-6 6'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
    </div>
    ${isExp ? `<div style="display:flex;flex-direction:column;gap:6px;padding:9px;border-top:1px solid var(--border)">${childRows}</div>` : ''}
  </div>`;
}

function renderPreview(): void {
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

  listEl.querySelectorAll<HTMLElement>('.pv-card').forEach((card) => {
    const url = card.dataset.url!;
    const v = allVideos().find((x) => x.url === url);
    card.querySelector('.pv-toggle')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (v && !STATUS_META[statusOf(v)].downloadable) return;
      sel.has(url) ? sel.delete(url) : sel.add(url);
      renderPreview();
    });
  });
  listEl.querySelectorAll<HTMLElement>('.pv-opts').forEach((b) =>
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      openVideoOpts(b.dataset.url!);
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
        | PlaylistMeta
        | undefined;
      if (!p) return;
      const selectable = p.entries.filter((v) => STATUS_META[statusOf(v)].downloadable);
      const allSel = selectable.length > 0 && selectable.every((v) => sel.has(v.url));
      selectable.forEach((v) => (allSel ? sel.delete(v.url) : sel.add(v.url)));
      renderPreview();
    }),
  );

  // toolbar
  const total = allVideos().length;
  $('preview-count-label').textContent = `${total} video${total === 1 ? '' : 's'}`;
  $('btn-filter-dl').hidden = false;
  $('btn-select-all').hidden = false;
  $('btn-filter-dl').setAttribute(
    'style',
    `font-size:12px;font-weight:600;padding:6px 11px;border-radius:8px;border:1.5px solid ${
      onlyDownloadable ? 'var(--accent)' : 'var(--border)'
    };background:${onlyDownloadable ? 'var(--accentSoft)' : 'transparent'};color:${onlyDownloadable ? 'var(--accent)' : 'var(--text2)'}`,
  );
  refreshSummary();
}

function refreshSummary(): void {
  const chosen = allVideos().filter((v) => sel.has(v.url) && STATUS_META[statusOf(v)].downloadable);
  $('sel-count').textContent = `${chosen.length} seleccionados`;
  $('options-summary').textContent =
    opts.mode === 'audio'
      ? `${opts.audioFmt} · ${opts.bitrate} kbps`
      : `${Q_LABEL[opts.quality]} · ${opts.container}${opts.mode === 'video' ? ' · sin audio' : ''}${opts.subs ? ' · Subs' : ''}`;
  const estMB = chosen.reduce((a, v) => a + sizeMB(v), 0);
  $('est-total').textContent = estMB ? fmtSize(estMB) : '—';
  $('download-label').textContent = `Descargar ${chosen.length || ''}`.trim();
}

// ---------- per-video options modal ----------
let ovUrl: string | null = null;
function openVideoOpts(url: string): void {
  ovUrl = url;
  const v = allVideos().find((x) => x.url === url);
  $('ov-title').textContent = v?.title ?? url;
  const cur = { ...opts, ...(overrides[url] || {}) };
  const overlay = $('ov-overlay');
  overlay.hidden = false;
  const paint = () => {
    const eff = { ...opts, ...(overrides[url] || {}) };
    $('ov-video-block').hidden = eff.mode === 'audio';
    $('ov-audio-block').hidden = eff.mode !== 'audio';
    renderChipsInto('ovMode', [['av', 'Video + audio'], ['video', 'Solo video'], ['audio', 'Solo audio']], eff.mode, (val) => setOv('mode', val));
    renderChipsInto('ovQuality', [['max', 'Máxima'], ['4k', '4K'], ['1440p', '1440p'], ['1080p', '1080p'], ['720p', '720p'], ['480p', '480p']], eff.quality, (val) => setOv('quality', val));
    renderChipsInto('ovContainer', [['MP4', 'MP4'], ['MKV', 'MKV'], ['WebM', 'WebM']], eff.container, (val) => setOv('container', val));
    renderChipsInto('ovAudioFmt', [['MP3', 'MP3'], ['M4A', 'M4A'], ['Opus', 'Opus']], eff.audioFmt, (val) => setOv('audioFmt', val));
    renderChipsInto('ovBitrate', [['128', '128'], ['192', '192'], ['256', '256'], ['320', '320']], eff.bitrate, (val) => setOv('bitrate', val));
    $('ov-clear').hidden = !overrides[url];
  };
  const setOv = (k: keyof Opts, val: string) => {
    overrides[url] = { ...(overrides[url] || {}), [k]: val };
    paint();
  };
  void cur;
  paint();
}
function renderChipsInto(group: string, list: [string, string][], curVal: string, onPick: (v: string) => void): void {
  const el = document.querySelector<HTMLElement>(`[data-group="${group}"]`);
  if (!el) return;
  el.innerHTML = list.map(([v, l]) => `<button data-val="${v}" style="${chipStyle(v === curVal)}">${l}</button>`).join('');
  el.querySelectorAll<HTMLElement>('[data-val]').forEach((b) => b.addEventListener('click', () => onPick(b.dataset.val!)));
}

// ---------- download ----------
async function analyze(): Promise<void> {
  const urls = $('url-input')
    ? ($('url-input') as HTMLTextAreaElement).value.split('\n').map((l) => l.trim()).filter((l) => l.startsWith('http'))
    : [];
  if (urls.length === 0) {
    showToast('Sin enlaces', 'Pega al menos un enlace para previsualizar.', 'warn');
    return;
  }
  const btn = $('btn-analyze') as HTMLButtonElement;
  btn.disabled = true;
  const orig = btn.innerHTML;
  btn.innerHTML = `${I.spinner} Analizando…`;
  $('preview-list').innerHTML = `<div style="display:flex;align-items:center;justify-content:center;gap:9px;padding:26px;color:var(--text2);font-size:12.5px">${I.spinner} Resolviendo metadatos de los enlaces…</div>`;
  $('preview-empty').hidden = true;
  const unlisten = await onPreviewProgress((done, total) => {
    btn.innerHTML = `${I.spinner} ${done}/${total}…`;
  });
  try {
    const hist = await getHistory().catch(() => []);
    downloadedSet = new Set(hist.map((h) => h.url));
    entries = await analyzeUrls(urls);
    // auto-seleccionar descargables no duplicados
    sel.clear();
    for (const v of allVideos()) {
      const st = statusOf(v);
      if (STATUS_META[st].downloadable && !(v as VideoMeta & { _dup?: boolean })._dup && st !== 'downloaded') sel.add(v.url);
    }
    renderPreview();
  } catch (e) {
    $('preview-list').innerHTML = `<div style="padding:24px;text-align:center;color:var(--danger);font-size:13px">Error: ${esc(String(e))}</div>`;
  } finally {
    unlisten();
    btn.disabled = false;
    btn.innerHTML = orig;
  }
}

function startDownload(): void {
  const chosen = allVideos().filter((v) => sel.has(v.url) && STATUS_META[statusOf(v)].downloadable);
  if (chosen.length === 0) {
    showToast('Nada seleccionado', 'Marca al menos un video descargable.', 'warn');
    return;
  }
  const cookieMode = getCookieMode();
  const items = chosen.map((v) => {
    const eff = { ...opts, ...(overrides[v.url] || {}) };
    return {
      url: v.url,
      title: v.title,
      channel: v.channel,
      grad: gradFor(v.id || v.url),
      thumbnail: v.thumbnail,
      fmt: fmtDescription(eff),
      options: optsToBackend(eff, cookieMode),
    };
  });
  enqueue(items);
  bus.emit('nav:goto', { view: 'cola' });
  showToast('Añadido a la cola', `${items.length} ${items.length === 1 ? 'video' : 'videos'} en proceso.`, 'done');
}

export function initDescargar(): void {
  renderModeCards();
  renderChips('quality', [['max', 'Máxima'], ['4k', '4K'], ['1440p', '1440p'], ['1080p', '1080p'], ['720p', '720p'], ['480p', '480p']], () => opts.quality, (v) => (opts.quality = v));
  renderChips('container', [['MP4', 'MP4'], ['MKV', 'MKV'], ['WebM', 'WebM']], () => opts.container, (v) => (opts.container = v));
  renderChips('audioFmt', [['MP3', 'MP3'], ['M4A', 'M4A'], ['Opus', 'Opus']], () => opts.audioFmt, (v) => (opts.audioFmt = v));
  renderChips('bitrate', [['128', '128'], ['192', '192'], ['256', '256'], ['320', '320']], () => opts.bitrate, (v) => (opts.bitrate = v));
  renderToggle('toggle-subs', () => opts.subs, (v) => (opts.subs = v));
  renderToggle('toggle-thumb', () => opts.thumb, (v) => (opts.thumb = v));

  const tpl = $('opt-template') as HTMLInputElement;
  tpl.value = opts.template;
  tpl.addEventListener('input', () => (opts.template = tpl.value));

  const urlInput = $('url-input') as HTMLTextAreaElement;
  urlInput.addEventListener('input', () => {
    const n = urlInput.value.split('\n').filter((l) => l.trim()).length;
    $('link-count').textContent = `${n} línea${n === 1 ? '' : 's'}`;
  });

  $('btn-analyze').addEventListener('click', analyze);
  $('btn-download').addEventListener('click', startDownload);
  $('btn-go-youtube').addEventListener('click', () => bus.emit('nav:goto', { view: 'youtube' }));
  $('btn-filter-dl').addEventListener('click', () => {
    onlyDownloadable = !onlyDownloadable;
    renderPreview();
  });
  $('btn-select-all').addEventListener('click', () => {
    const dl = allVideos().filter((v) => STATUS_META[statusOf(v)].downloadable);
    const allOn = dl.every((v) => sel.has(v.url));
    dl.forEach((v) => (allOn ? sel.delete(v.url) : sel.add(v.url)));
    renderPreview();
  });

  // folder
  getDownloadFolder().then((p) => ($('folder-path').textContent = p));
  $('btn-change-folder').addEventListener('click', async () => {
    const p = await changeDownloadFolder();
    if (p) $('folder-path').textContent = p;
  });

  // per-video opts modal
  $('ov-close').addEventListener('click', () => ($('ov-overlay').hidden = true));
  $('ov-done').addEventListener('click', () => {
    $('ov-overlay').hidden = true;
    renderPreview();
  });
  $('ov-clear').addEventListener('click', () => {
    if (ovUrl) delete overrides[ovUrl];
    $('ov-overlay').hidden = true;
    renderPreview();
  });

  refreshSummary();
}
