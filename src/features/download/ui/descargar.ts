import { I, esc } from '../../../app/icons';
import { bus } from '../../../core/bus/event-bus';
import { t } from '../../../core/i18n';
import { showToast } from '../../../shared/ui/toast';
import { analyzeUrls, onPreviewProgress } from '../../preview/preview.api';
import type { AnalyzedEntry, VideoMeta, PlaylistMeta } from '../../preview/preview.types';
import { getCookieMode } from '../../session';
import { getDownloadFolder, getSettings } from '../../settings/settings.api';
import type { AppConfig } from '../../settings/settings.types';
import { getHistory } from '../../library/library.api';
import { enqueue } from '../../queue';
import type { DownloadOptions } from '../download.types';

// ---------- estado de opciones ----------
interface Opts {
  mode: 'av' | 'video' | 'audio';
  quality: string; // max|4k|1440p|1080p|720p|480p
  container: 'MP4' | 'MKV' | 'WebM';
  audioFmt: 'MP3' | 'M4A' | 'Opus';
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
  get max() {
    return t('Máxima', 'Max');
  },
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
// Ajustes guarda la calidad en formato backend ('max', '2160', '1080'…) y el
// contenedor en minúsculas ('mp4'); mapear a los literales de esta vista.
// 'auto' no tiene chip aquí: se mantiene el valor por defecto ('max').
const SETTINGS_Q: Record<string, string> = {
  max: 'max',
  '2160': '4k',
  '1440': '1440p',
  '1080': '1080p',
  '720': '720p',
  '480': '480p',
};
const SETTINGS_C: Record<string, Opts['container']> = { mp4: 'MP4', mkv: 'MKV', webm: 'WebM' };
// Mapeos UI → backend de contenedor y formato de audio (evitan casts sobre toLowerCase()).
const CONTAINER_BACKEND: Record<Opts['container'], DownloadOptions['container']> = { MP4: 'mp4', MKV: 'mkv', WebM: 'webm' };
const AUDIO_BACKEND: Record<Opts['audioFmt'], DownloadOptions['audioFormat']> = { MP3: 'mp3', M4A: 'm4a', Opus: 'opus' };

export function optsToBackend(o: Opts, cookieMode: string): DownloadOptions {
  return {
    mode: o.mode === 'audio' ? 'audio' : o.mode === 'video' ? 'videoonly' : 'video',
    quality: Q_BACKEND[o.quality] ?? 'auto',
    container: CONTAINER_BACKEND[o.container],
    audioFormat: AUDIO_BACKEND[o.audioFmt],
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
const STATUS_META: Record<Status, { readonly label: string; color: string; downloadable: boolean }> = {
  ok: { get label() { return t('Descargable', 'Downloadable'); }, color: 'var(--success)', downloadable: true },
  members: { get label() { return t('De miembros · requiere sesión', 'Members-only · requires session'); }, color: 'var(--warn)', downloadable: true },
  downloaded: { get label() { return t('Ya descargado', 'Already downloaded'); }, color: 'var(--info)', downloadable: true },
  private: { get label() { return t('Privado · no disponible', 'Private · not available'); }, color: 'var(--text3)', downloadable: false },
  region: { get label() { return t('Bloqueado por región', 'Region-blocked'); }, color: 'var(--warn)', downloadable: false },
  error: { get label() { return t('No disponible', 'Not available'); }, color: 'var(--danger)', downloadable: false },
};
function sizeMB(v: VideoMeta): number {
  // size_bytes del backend ya es ~el tamaño a 1080p (mejor video ≤1080 + audio),
  // y Q_FACTOR['1080p'] === 1, así que el factor va directo (no dividir por max).
  const eff = { ...opts, ...(overrides[v.url] || {}) };
  const base = v.size_bytes ? v.size_bytes / 1048576 : 0;
  const rel = Q_FACTOR[eff.quality] ?? 1;
  return base * rel * (eff.mode === 'audio' ? 0.08 : 1);
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

const MODE_DEFS = () => [
  { id: 'av', title: t('Video + audio', 'Video + audio'), sub: t('La opción más común', 'The most common option'), icon: I.film, bg: 'var(--infoSoft)', c: 'var(--info)' },
  { id: 'video', title: t('Solo video', 'Video only'), sub: t('Sin pista de audio', 'No audio track'), icon: I.video, bg: 'var(--accentSoft)', c: 'var(--accent)' },
  { id: 'audio', title: t('Solo audio', 'Audio only'), sub: t('MP3 / M4A / Opus', 'MP3 / M4A / Opus'), icon: I.music, bg: 'var(--successSoft)', c: 'var(--success)' },
];

function renderModeCards(): void {
  $('mode-cards').innerHTML = MODE_DEFS().map((m) => {
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
        renderPreview(); // los badges de tamaño por tarjeta dependen del modo
        refreshSummary();
      }),
    );
}

function renderChips<T extends string>(groupSel: string, list: [T, string][], get: () => string, set: (v: T) => void): void {
  const el = document.querySelector<HTMLElement>(`[data-group="${groupSel}"]`);
  if (!el) return;
  el.innerHTML = list
    .map(([v, l]) => `<button data-val="${v}" style="${chipStyle(v === get())}">${l}</button>`)
    .join('');
  // El valor se toma de `list` por índice (mismo orden que el innerHTML) para
  // conservar el tipo literal T sin castear dataset.val (que siempre es string).
  el.querySelectorAll<HTMLElement>('[data-val]').forEach((b, i) =>
    b.addEventListener('click', () => {
      set(list[i][0]);
      renderChips(groupSel, list, get, set);
      if (groupSel === 'quality') renderPreview();
      refreshSummary();
    }),
  );
}

// ---------- historial de enlaces recientes (localStorage) ----------
const RECENT_KEY = 'stash.recentLinks';
interface RecentLink {
  url: string;
  ts: number;
}
function loadRecents(): RecentLink[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    if (Array.isArray(raw))
      return (raw as RecentLink[]).filter((r) => r && typeof r.url === 'string' && typeof r.ts === 'number');
  } catch {
    /* dato corrupto: se ignora */
  }
  return [];
}
function addRecentLinks(urls: string[]): void {
  const now = Date.now();
  const merged = [...urls.map((u) => ({ url: u, ts: now })), ...loadRecents()];
  const seen = new Set<string>();
  const out = merged.filter((r) => !seen.has(r.url) && !!seen.add(r.url)).slice(0, 50);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(out));
  } catch {
    /* sin espacio: no es crítico */
  }
}
function lineCountLabel(n: number): string {
  return t(`${n} línea${n === 1 ? '' : 's'}`, `${n} line${n === 1 ? '' : 's'}`);
}
function timeAgo(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return t('ahora', 'now');
  const m = Math.floor(s / 60);
  if (m < 60) return t(`hace ${m} min`, `${m} min ago`);
  const h = Math.floor(m / 60);
  if (h < 24) return t(`hace ${h} h`, `${h} h ago`);
  return t(`hace ${Math.floor(h / 24)} d`, `${Math.floor(h / 24)} d ago`);
}
function renderRecentPanel(): void {
  const panel = $('recent-panel');
  const items = loadRecents();
  if (items.length === 0) {
    panel.innerHTML = `<div style="padding:18px 12px;text-align:center;font-size:12px;color:var(--text3)">${t('Sin enlaces recientes', 'No recent links')}</div>`;
    return;
  }
  const rows = items
    .map(
      (r) => `<button class="rl-item hov" data-url="${esc(r.url)}" title="${esc(r.url)}" style="display:flex;align-items:center;gap:8px;width:100%;padding:7px 9px;border-radius:8px;text-align:left">
      <span style="flex:1;min-width:0;font-size:11.5px;color:var(--text);font-family:'JetBrains Mono',monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.url)}</span>
      <span style="flex:none;font-size:10.5px;color:var(--text3)">${timeAgo(r.ts)}</span>
    </button>`,
    )
    .join('');
  panel.innerHTML = `<div style="display:flex;flex-direction:column">${rows}</div>
    <div style="border-top:1px solid var(--border);margin-top:6px;padding-top:6px">
      <button id="rl-clear" class="hov" style="width:100%;padding:7px;border-radius:8px;font-size:11.5px;font-weight:600;color:var(--danger)">${t('Limpiar recientes', 'Clear recents')}</button>
    </div>`;
  panel.querySelectorAll<HTMLElement>('.rl-item').forEach((b) =>
    b.addEventListener('click', () => {
      // Añade el enlace al textarea sin duplicar líneas y actualiza el contador.
      const input = $('url-input') as HTMLTextAreaElement;
      const lines = input.value.split('\n').map((l) => l.trim()).filter(Boolean);
      if (!lines.includes(b.dataset.url!)) lines.push(b.dataset.url!);
      input.value = lines.join('\n');
      $('link-count').textContent = lineCountLabel(lines.length);
    }),
  );
  panel.querySelector('#rl-clear')?.addEventListener('click', () => {
    try {
      localStorage.removeItem(RECENT_KEY);
    } catch {
      /* ignorar */
    }
    renderRecentPanel();
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
  // Opciones efectivas: globales + override parcial (evita "undefined" si el
  // override solo cambia algunos campos).
  const eff = { ...opts, ...(ov || {}) };
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

  const vids = allVideos();
  const byUrl = new Map<string, VideoMeta>();
  for (const v of vids) if (!byUrl.has(v.url)) byUrl.set(v.url, v);

  listEl.querySelectorAll<HTMLElement>('.pv-card').forEach((card) => {
    const url = card.dataset.url!;
    const v = byUrl.get(url);
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
  const total = vids.length;
  $('preview-count-label').textContent = `${total} video${total === 1 ? '' : 's'}`; // «video(s)» es igual en ambos idiomas
  $('btn-filter-dl').hidden = false;
  $('btn-select-all').hidden = false;
  const selectable = vids.filter((v) => STATUS_META[statusOf(v)].downloadable);
  const allOn = selectable.length > 0 && selectable.every((v) => sel.has(v.url));
  $('btn-select-all').textContent = allOn ? t('Quitar selección', 'Clear selection') : t('Seleccionar todo', 'Select all');
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
  // Cuántos de los seleccionados llevan opciones personalizadas (override no vacío).
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

// ---------- per-video options modal ----------
let ovUrl: string | null = null;
// Borrador de overrides: los cambios solo se aplican a `overrides` al pulsar
// "Listo"; cerrar con la X / Escape / backdrop los descarta.
let ovDraft: Partial<Opts> | null = null;
function openVideoOpts(url: string): void {
  ovUrl = url;
  const v = allVideos().find((x) => x.url === url);
  $('ov-title').textContent = v?.title ?? url;
  ovDraft = { ...(overrides[url] || {}) };
  $('ov-overlay').hidden = false;
  // La sección "Avanzado" arranca plegada en cada apertura.
  $('ov-adv-body').hidden = true;
  $('ov-adv-arrow').style.transform = '';
  const paint = () => {
    const eff = { ...opts, ...(ovDraft || {}) };
    $('ov-video-block').hidden = eff.mode === 'audio';
    $('ov-audio-block').hidden = eff.mode !== 'audio';
    renderChipsInto('ovMode', [['av', t('Video + audio', 'Video + audio')], ['video', t('Solo video', 'Video only')], ['audio', t('Solo audio', 'Audio only')]], eff.mode, (val) => setOv('mode', val));
    renderChipsInto('ovQuality', [['max', t('Máxima', 'Max')], ['4k', '4K'], ['1440p', '1440p'], ['1080p', '1080p'], ['720p', '720p'], ['480p', '480p']], eff.quality, (val) => setOv('quality', val));
    renderChipsInto('ovContainer', [['MP4', 'MP4'], ['MKV', 'MKV'], ['WebM', 'WebM']], eff.container, (val) => setOv('container', val));
    renderChipsInto('ovAudioFmt', [['MP3', 'MP3'], ['M4A', 'M4A'], ['Opus', 'Opus']], eff.audioFmt, (val) => setOv('audioFmt', val));
    renderChipsInto('ovBitrate', [['128', '128'], ['192', '192'], ['256', '256'], ['320', '320']], eff.bitrate, (val) => setOv('bitrate', val));
    // Avanzado: subs / miniatura / plantilla — también editan solo el borrador.
    // Se usa .onclick/.oninput (no addEventListener) para no acumular listeners
    // entre repintados y aperturas del modal.
    const paintTgl = (id: string, key: 'subs' | 'thumb') => {
      const btn = $(id) as HTMLButtonElement;
      const on = !!eff[key];
      btn.setAttribute('style', toggleStyle(on));
      btn.innerHTML = knob;
      btn.dataset.on = on ? '1' : '0';
      btn.onclick = () => {
        ovDraft = { ...(ovDraft || {}), [key]: !on };
        paint();
      };
    };
    paintTgl('ov-toggle-subs', 'subs');
    paintTgl('ov-toggle-thumb', 'thumb');
    const tplIn = $('ov-template') as HTMLInputElement;
    if (document.activeElement !== tplIn) tplIn.value = eff.template;
    tplIn.oninput = () => {
      ovDraft = { ...(ovDraft || {}), template: tplIn.value };
      $('ov-clear').hidden = false; // sin repintar: no interrumpir la escritura
    };
    $('ov-clear').hidden = Object.keys(ovDraft || {}).length === 0;
  };
  const setOv = <K extends keyof Opts>(k: K, val: Opts[K]) => {
    const draft: Partial<Opts> = { ...(ovDraft || {}) };
    draft[k] = val;
    ovDraft = draft;
    paint();
  };
  paint();
}
function closeVideoOpts(commit: boolean): void {
  if (commit && ovUrl && ovDraft) {
    if (Object.keys(ovDraft).length > 0) overrides[ovUrl] = ovDraft;
    else delete overrides[ovUrl];
  }
  ovUrl = null;
  ovDraft = null;
  $('ov-overlay').hidden = true;
  renderPreview(); // resincroniza icono de engranaje y badge de override
}
function renderChipsInto<T extends string>(group: string, list: [T, string][], curVal: string, onPick: (v: T) => void): void {
  const el = document.querySelector<HTMLElement>(`[data-group="${group}"]`);
  if (!el) return;
  el.innerHTML = list.map(([v, l]) => `<button data-val="${v}" style="${chipStyle(v === curVal)}">${l}</button>`).join('');
  // Igual que renderChips: el valor sale de `list` por índice para conservar T.
  el.querySelectorAll<HTMLElement>('[data-val]').forEach((b, i) => b.addEventListener('click', () => onPick(list[i][0])));
}

// ---------- download ----------
async function analyze(): Promise<void> {
  const urls = $('url-input')
    ? ($('url-input') as HTMLTextAreaElement).value.split('\n').map((l) => l.trim()).filter((l) => l.startsWith('http'))
    : [];
  if (urls.length === 0) {
    showToast(t('Sin enlaces', 'No links'), t('Pega al menos un enlace para previsualizar.', 'Paste at least one link to preview.'), 'warn');
    return;
  }
  const btn = $('btn-analyze') as HTMLButtonElement;
  btn.disabled = true;
  const orig = btn.innerHTML;
  btn.innerHTML = `${I.spinner} ${t('Analizando…', 'Analyzing…')}`;
  $('preview-list').innerHTML = `<div style="display:flex;align-items:center;justify-content:center;gap:9px;padding:26px;color:var(--text2);font-size:12.5px">${I.spinner} ${t('Resolviendo metadatos de los enlaces…', 'Resolving link metadata…')}</div>`;
  $('preview-empty').hidden = true;
  const unlisten = await onPreviewProgress((done, total) => {
    btn.innerHTML = `${I.spinner} ${done}/${total}…`;
  });
  try {
    const hist = await getHistory().catch(() => []);
    downloadedSet = new Set(hist.flatMap((h) => (h.videoId ? [h.url, h.videoId] : [h.url])));
    entries = await analyzeUrls(urls);
    sel.clear();
    const vids = allVideos();
    // Auto-seleccionar solo si son pocos, para no marcar cientos sin querer.
    if (vids.length <= 20) {
      for (const v of vids) {
        const st = statusOf(v);
        if (STATUS_META[st].downloadable && !(v as VideoMeta & { _dup?: boolean })._dup && st !== 'downloaded') sel.add(v.url);
      }
    } else {
      showToast(
        t('Lista grande', 'Large list'),
        t(`${vids.length} videos — elige cuáles descargar (o "Seleccionar todo").`, `${vids.length} videos — choose which to download (or "Select all").`),
        'info',
      );
    }
    renderPreview();
    // Historial de enlaces analizados (para el botón "Recientes").
    addRecentLinks(urls);
    // Auto-limpiar el cuadro de enlaces tras un análisis exitoso, salvo que el
    // ajuste lo desactive; se lee fresco para respetar cambios recientes.
    const cfg = await getSettings().catch(() => null);
    if (cfg?.clear_links_after_preview !== false) {
      ($('url-input') as HTMLTextAreaElement).value = '';
      $('link-count').textContent = lineCountLabel(0);
    }
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
    showToast(t('Nada seleccionado', 'Nothing selected'), t('Marca al menos un video descargable.', 'Check at least one downloadable video.'), 'warn');
    return;
  }
  const cookieMode = getCookieMode();
  const items = chosen.map((v) => {
    const eff = { ...opts, ...(overrides[v.url] || {}) };
    return {
      url: v.url,
      videoId: v.id || undefined,
      title: v.title,
      channel: v.channel,
      duration: v.duration,
      grad: gradFor(v.id || v.url),
      thumbnail: v.thumbnail,
      fmt: fmtDescription(eff),
      options: optsToBackend(eff, cookieMode),
    };
  });
  enqueue(items);
  // Limpiar la selección para que volver a pulsar "Descargar" no encole
  // duplicados; la preview se conserva por si se quieren elegir otros videos.
  sel.clear();
  renderPreview();
  bus.emit('nav:goto', { view: 'cola' });
  showToast(
    t('Añadido a la cola', 'Added to queue'),
    t(`${items.length} ${items.length === 1 ? 'video' : 'videos'} en proceso.`, `${items.length} ${items.length === 1 ? 'video' : 'videos'} in progress.`),
    'done',
  );
}

export function initDescargar(): void {
  renderModeCards();
  const paintQuality = () =>
    renderChips('quality', [['max', t('Máxima', 'Max')], ['4k', '4K'], ['1440p', '1440p'], ['1080p', '1080p'], ['720p', '720p'], ['480p', '480p']], () => opts.quality, (v) => (opts.quality = v));
  const paintContainer = () =>
    renderChips('container', [['MP4', 'MP4'], ['MKV', 'MKV'], ['WebM', 'WebM']], () => opts.container, (v) => (opts.container = v));
  paintQuality();
  paintContainer();
  renderChips('audioFmt', [['MP3', 'MP3'], ['M4A', 'M4A'], ['Opus', 'Opus']], () => opts.audioFmt, (v) => (opts.audioFmt = v));
  renderChips('bitrate', [['128', '128'], ['192', '192'], ['256', '256'], ['320', '320']], () => opts.bitrate, (v) => (opts.bitrate = v));

  // Aplicar los ajustes de "Descarga por defecto" (los defaults de modo, subs,
  // miniatura y plantilla ya no tienen controles aquí: viven en Ajustes). Si no
  // se pueden leer, se mantienen los valores por defecto (Máxima / MP4).
  const applyDefaults = (cfg: AppConfig): void => {
    const q = SETTINGS_Q[cfg.default_quality];
    if (q) opts.quality = q;
    const c = SETTINGS_C[(cfg.default_container || '').toLowerCase()];
    if (c) opts.container = c;
    if (cfg.default_mode !== undefined) opts.mode = cfg.default_mode === 'audio' ? 'audio' : 'av';
    if (typeof cfg.default_template === 'string' && cfg.default_template.trim()) opts.template = cfg.default_template;
    if (typeof cfg.default_subtitles === 'boolean') opts.subs = cfg.default_subtitles;
    if (typeof cfg.default_thumbnail === 'boolean') opts.thumb = cfg.default_thumbnail;
    $('video-opts').hidden = opts.mode === 'audio';
    $('audio-opts').hidden = opts.mode !== 'audio';
    renderModeCards();
    paintQuality();
    paintContainer();
    refreshSummary();
  };
  getSettings()
    .then((cfg) => applyDefaults(cfg))
    .catch(() => {});

  const urlInput = $('url-input') as HTMLTextAreaElement;
  urlInput.addEventListener('input', () => {
    const n = urlInput.value.split('\n').filter((l) => l.trim()).length;
    $('link-count').textContent = lineCountLabel(n);
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

  // Carpeta de destino: solo informativa; se cambia desde Ajustes.
  const paintFolder = () =>
    getDownloadFolder()
      .then((p) => ($('folder-path').textContent = p))
      .catch(() => {});
  void paintFolder();
  $('btn-open-ajustes').addEventListener('click', () => bus.emit('nav:goto', { view: 'ajustes' }));

  // Al volver a la vista: refrescar siempre la línea de carpeta (pudo cambiar
  // en Ajustes) y re-aplicar los defaults SOLO si no hay una tanda cargada —
  // con preview activa el usuario pudo ajustar opciones para esos videos y no
  // hay que pisárselas a mitad de sesión.
  bus.on('nav:changed', ({ view }) => {
    if (view !== 'descargar') return;
    void paintFolder();
    if (entries.length === 0)
      getSettings()
        .then((cfg) => applyDefaults(cfg))
        .catch(() => {});
  });

  // Panel de enlaces recientes: anclado a la cabecera del cuadro de enlaces;
  // se cierra con click fuera o Escape.
  const recentPanel = $('recent-panel');
  $('btn-recents').addEventListener('click', (e) => {
    e.stopPropagation();
    if (recentPanel.hidden) {
      renderRecentPanel();
      recentPanel.hidden = false;
    } else {
      recentPanel.hidden = true;
    }
  });
  document.addEventListener('click', (e) => {
    if (!recentPanel.hidden && !recentPanel.contains(e.target as Node)) recentPanel.hidden = true;
  });

  // per-video opts modal: "Listo" aplica el borrador; X / Escape / backdrop cancelan
  $('ov-close').addEventListener('click', () => closeVideoOpts(false));
  $('ov-done').addEventListener('click', () => closeVideoOpts(true));
  $('ov-clear').addEventListener('click', () => {
    if (ovUrl) delete overrides[ovUrl];
    ovUrl = null;
    ovDraft = null;
    $('ov-overlay').hidden = true;
    renderPreview();
  });
  $('ov-overlay').addEventListener('click', (e) => {
    if (e.target === $('ov-overlay')) closeVideoOpts(false);
  });
  // Desplegable "Avanzado" del modal (flecha rota al abrir).
  $('ov-adv-toggle').addEventListener('click', () => {
    const body = $('ov-adv-body');
    body.hidden = !body.hidden;
    $('ov-adv-arrow').style.transform = body.hidden ? '' : 'rotate(90deg)';
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!$('ov-overlay').hidden) closeVideoOpts(false);
    else if (!recentPanel.hidden) recentPanel.hidden = true;
  });

  // Pre-carga de urls desde otras vistas (Mi YouTube, Buscar…): añade los
  // enlaces al textarea sin duplicar líneas y lanza el análisis. Funciona
  // aunque la vista no esté visible; la navegación la hace el emisor.
  bus.on('descargar:prefill', ({ urls }) => {
    if (!urls.length) return;
    const existing = urlInput.value.split('\n').map((l) => l.trim()).filter(Boolean);
    const known = new Set(existing);
    const added = urls.map((u) => u.trim()).filter((u) => u && !known.has(u) && known.add(u));
    urlInput.value = [...existing, ...added].join('\n');
    const n = urlInput.value.split('\n').filter((l) => l.trim()).length;
    $('link-count').textContent = lineCountLabel(n);
    void analyze();
  });

  // Marcar "Ya descargado" en vivo cuando termina una descarga, sin re-analizar.
  bus.on('download:completed', ({ url, videoId }) => {
    downloadedSet.add(url);
    if (videoId) downloadedSet.add(videoId);
    if (entries.length) renderPreview();
  });

  refreshSummary();
}
