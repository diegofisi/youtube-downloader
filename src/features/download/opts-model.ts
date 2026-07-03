import { t } from '../../core/i18n';
import type { VideoMeta } from '../preview';
import type { AppConfig } from '../settings';
import type { DownloadOptions } from './download.types';

// Modelo del slice de descarga: estado de opciones globales y por-video,
// mapeos UI ↔ backend y cálculos derivados. SIN DOM: las vistas importan de
// aquí, nunca al revés.

// ---------- estado de opciones ----------
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

// Opciones efectivas de un video: globales + override parcial (evita
// "undefined" si el override solo cambia algunos campos).
export function effectiveOpts(url: string): Opts {
  return { ...opts, ...(overrides[url] || {}) };
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
  // size_bytes del backend ya es ~el tamaño a 1080p (mejor video ≤1080 + audio),
  // y Q_FACTOR['1080p'] === 1, así que el factor va directo (no dividir por max).
  const eff = effectiveOpts(v.url);
  const base = v.size_bytes ? v.size_bytes / 1048576 : 0;
  const rel = Q_FACTOR[eff.quality] ?? 1;
  return base * rel * (eff.mode === 'audio' ? 0.08 : 1);
}

// Aplicar los ajustes de "Descarga por defecto" (los defaults de modo, subs,
// miniatura y plantilla ya no tienen controles en la vista: viven en Ajustes).
// Si no se pueden leer, se mantienen los valores por defecto (Máxima / MP4).
// Solo muta el estado; el repintado lo hace el orquestador (descargar.ts).
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
