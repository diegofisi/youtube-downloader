import { t } from '../../core/i18n';
import type { VideoMeta } from '../preview';
import type { AppConfig } from '../settings';
import type { DownloadOptions } from './download.types';

// Download slice model: global and per-video option state, UI ↔ backend mappings
// and derived calculations. No DOM: views import from here, never the reverse.

// ---------- option state ----------
export interface Opts {
  mode: 'av' | 'video' | 'audio';
  quality: string; // max|4k|1440p|1080p|720p|480p
  container: 'MP4' | 'MKV' | 'WebM';
  audioFmt: 'MP3' | 'M4A' | 'Opus';
  bitrate: string; // 320...
  subs: boolean;
  thumb: boolean;
  template: string;
}
export const opts: Opts = {
  mode: 'av',
  quality: 'max',
  container: 'MP4',
  audioFmt: 'MP3',
  bitrate: '320',
  subs: false,
  thumb: true,
  template: '%(title)s [%(id)s]',
};
export const overrides: Record<string, Partial<Opts>> = {};

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
export const Q_LABEL: Record<string, string> = {
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
// Settings stores quality in backend format ('max', '2160'…) and container lowercase ('mp4');
// map to this view's literals. 'auto' has no chip here: the default ('max') is kept.
const SETTINGS_Q: Record<string, string> = {
  max: 'max',
  '2160': '4k',
  '1440': '1440p',
  '1080': '1080p',
  '720': '720p',
  '480': '480p',
};
const SETTINGS_C: Record<string, Opts['container']> = { mp4: 'MP4', mkv: 'MKV', webm: 'WebM' };
// UI → backend mappings for container and audio format (avoid casts on toLowerCase()).
const CONTAINER_BACKEND: Record<Opts['container'], DownloadOptions['container']> = {
  MP4: 'mp4',
  MKV: 'mkv',
  WebM: 'webm',
};
const AUDIO_BACKEND: Record<Opts['audioFmt'], DownloadOptions['audioFormat']> = {
  MP3: 'mp3',
  M4A: 'm4a',
  Opus: 'opus',
};

// Effective options for a video: globals + partial override (avoids
// "undefined" when the override only changes some fields).
export function effectiveOpts(url: string): Opts {
  return { ...opts, ...(overrides[url] || {}) };
}

// Overrides are per-batch: on each new analysis, drop entries for URLs that left
// the preview so the map doesn't grow unbounded across the session.
export function pruneOverrides(keep: ReadonlySet<string>): void {
  for (const url of Object.keys(overrides)) if (!keep.has(url)) delete overrides[url];
}

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

export function sizeMB(v: VideoMeta): number {
  // Backend size_bytes is already ~the 1080p size (best video ≤1080 + audio) and
  // Q_FACTOR['1080p'] === 1, so the factor applies directly (no division by max).
  const eff = effectiveOpts(v.url);
  const base = v.size_bytes ? v.size_bytes / 1048576 : 0;
  const rel = Q_FACTOR[eff.quality] ?? 1;
  return base * rel * (eff.mode === 'audio' ? 0.08 : 1);
}

// Applies the "Default download" settings (mode/subs/thumbnail/template live in Settings, not here).
// Unreadable values keep the defaults. Only mutates state; the orchestrator (descargar.ts) repaints.
export function applyDefaults(cfg: AppConfig): void {
  const q = SETTINGS_Q[cfg.default_quality];
  if (q) opts.quality = q;
  const c = SETTINGS_C[(cfg.default_container || '').toLowerCase()];
  if (c) opts.container = c;
  if (cfg.default_mode !== undefined) opts.mode = cfg.default_mode === 'audio' ? 'audio' : 'av';
  if (typeof cfg.default_template === 'string' && cfg.default_template.trim()) opts.template = cfg.default_template;
  if (typeof cfg.default_subtitles === 'boolean') opts.subs = cfg.default_subtitles;
  if (typeof cfg.default_thumbnail === 'boolean') opts.thumb = cfg.default_thumbnail;
}
