import { t } from '@/shared/lib/messages/t';
import type { AnalyzedVideo } from '../models/analyzed.model';
import type {
  BackendDownloadOptions,
  DownloadDefaults,
  DownloadOpts,
  OptsOverride,
} from '../models/download-opts.model';

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

const Q_LABEL_FIXED: Record<string, string> = {
  '4k': '4K',
  '1440p': '1440p',
  '1080p': '1080p',
  '720p': '720p',
  '480p': '480p',
};

export function qualityLabel(q: string): string {
  if (q === 'max') return t.download.qualityMax();
  return Q_LABEL_FIXED[q] ?? q;
}

const Q_BACKEND: Record<string, string> = {
  max: 'max',
  '4k': '2160',
  '1440p': '1440',
  '1080p': '1080',
  '720p': '720',
  '480p': '480',
};

// Settings stores quality in backend format ('2160'…) and container lowercase; map to this
// view's literals. 'auto' has no chip here, so the default ('max') is kept.
const SETTINGS_Q: Record<string, string> = {
  max: 'max',
  '2160': '4k',
  '1440': '1440p',
  '1080': '1080p',
  '720': '720p',
  '480': '480p',
};
const SETTINGS_C: Record<string, DownloadOpts['container']> = { mp4: 'MP4', mkv: 'MKV', webm: 'WebM' };

// Explicit maps avoid casts on toLowerCase().
const CONTAINER_BACKEND: Record<DownloadOpts['container'], BackendDownloadOptions['container']> = {
  MP4: 'mp4',
  MKV: 'mkv',
  WebM: 'webm',
};
const AUDIO_BACKEND: Record<DownloadOpts['audioFmt'], BackendDownloadOptions['audioFormat']> = {
  MP3: 'mp3',
  M4A: 'm4a',
  Opus: 'opus',
};

export function effectiveOpts(opts: DownloadOpts, override?: OptsOverride): DownloadOpts {
  return { ...opts, ...(override ?? {}) };
}

export function optsToBackend(o: DownloadOpts, cookieMode: string): BackendDownloadOptions {
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

export function fmtDescription(o: DownloadOpts): string {
  return o.mode === 'audio' ? `${o.audioFmt} · ${o.bitrate}` : `${qualityLabel(o.quality)} · ${o.container}`;
}

export function sizeMB(v: Pick<AnalyzedVideo, 'sizeBytes'>, eff: DownloadOpts): number {
  // Backend size_bytes is already ~the 1080p size (best video ≤1080 + audio) and
  // Q_FACTOR['1080p'] === 1, so the factor applies directly (no division by max).
  const base = v.sizeBytes ? v.sizeBytes / 1048576 : 0;
  const rel = Q_FACTOR[eff.quality] ?? 1;
  return base * rel * (eff.mode === 'audio' ? 0.08 : 1);
}

// Unreadable settings values keep the current ones.
export function applyDefaults(current: DownloadOpts, cfg: DownloadDefaults): DownloadOpts {
  const next = { ...current };
  const q = SETTINGS_Q[cfg.quality];
  if (q) next.quality = q;
  const c = SETTINGS_C[(cfg.container || '').toLowerCase()];
  if (c) next.container = c;
  next.mode = cfg.mode === 'audio' ? 'audio' : 'av';
  if (cfg.template.trim()) next.template = cfg.template;
  next.subs = cfg.subtitles;
  next.thumb = cfg.thumbnail;
  return next;
}

// Labels resolved at call time for live i18n.
export const qualityChips = (): { value: string; label: string }[] => [
  { value: 'max', label: t.download.qualityMax() },
  { value: '4k', label: '4K' },
  { value: '1440p', label: '1440p' },
  { value: '1080p', label: '1080p' },
  { value: '720p', label: '720p' },
  { value: '480p', label: '480p' },
];
export const containerChips = (): { value: DownloadOpts['container']; label: string }[] => [
  { value: 'MP4', label: 'MP4' },
  { value: 'MKV', label: 'MKV' },
  { value: 'WebM', label: 'WebM' },
];
export const audioFmtChips = (): { value: DownloadOpts['audioFmt']; label: string }[] => [
  { value: 'MP3', label: 'MP3' },
  { value: 'M4A', label: 'M4A' },
  { value: 'Opus', label: 'Opus' },
];
export const bitrateChips = (): { value: string; label: string }[] => [
  { value: '128', label: '128' },
  { value: '192', label: '192' },
  { value: '256', label: '256' },
  { value: '320', label: '320' },
];
export const modeChips = (): { value: DownloadOpts['mode']; label: string }[] => [
  { value: 'av', label: t.common.videoAndAudio() },
  { value: 'video', label: t.download.videoOnly() },
  { value: 'audio', label: t.common.audioOnly() },
];
