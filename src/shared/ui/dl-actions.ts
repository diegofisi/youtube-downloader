/**
 * Acciones de descarga comunes a las vistas de grid (Mi YouTube / Buscar):
 * opciones por defecto, conversión a item de cola, mini-menú por tarjeta y
 * handlers de "Descargar seleccionados" / "Personalizar".
 *
 * Consume únicamente los tipos y funciones PÚBLICOS de las fachadas de
 * download, queue, preview y session (features/x/index.ts), nunca sus internos.
 */
import { bus } from '../../core/bus/event-bus';
import { t } from '../../core/i18n';
import { I } from './icons';
import { CARD_GRAD } from './gradients';
import { showToast } from './toast';
import { openAnchoredMenu } from './anchored-menu';
import { enqueue } from '../../features/queue';
import type { EnqueueItem } from '../../features/queue';
import { getCookieMode } from '../../features/session';
import type { DownloadOptions } from '../../features/download';
import type { AnalyzedEntry, PlaylistMeta, VideoMeta } from '../../features/preview';

/** Aplana el resultado de analyzeUrls: expande playlists y descarta entradas sin id. */
export function flatten(entries: AnalyzedEntry[]): VideoMeta[] {
  const out: VideoMeta[] = [];
  for (const e of entries) {
    if (e.is_playlist && 'entries' in e) out.push(...(e as PlaylistMeta).entries);
    else out.push(e as VideoMeta);
  }
  return out.filter((v) => v.id);
}

/** Opciones de descarga por defecto de los grids (máxima calidad, MP4). */
export function defaultOptions(): DownloadOptions {
  return {
    mode: 'video',
    quality: 'max',
    container: 'mp4',
    audioFormat: 'mp3',
    audioBitrate: 0,
    subtitles: false,
    subLangs: 'es,en',
    embedThumbnail: true,
    outputTemplate: undefined,
    cookieMode: getCookieMode(),
  };
}

/** Convierte un VideoMeta del grid en un item listo para enqueue(). */
export function toQueueItem(v: VideoMeta): EnqueueItem {
  return {
    url: v.url,
    videoId: v.id,
    title: v.title,
    channel: v.channel,
    grad: CARD_GRAD,
    thumbnail: v.thumbnail,
    duration: v.duration,
    fmt: t('Máxima · MP4', 'Max · MP4'),
    options: defaultOptions(),
  };
}

/** Abre el menú "Descargar / Descarga personalizada" anclado al botón ⬇ de una tarjeta. */
export function openDlMenu(anchor: HTMLElement, v: VideoMeta): void {
  openAnchoredMenu(anchor, [
    {
      icon: I.download,
      label: t('Descargar', 'Download'),
      onPick: () => {
        enqueue([toQueueItem(v)]);
        showToast(t('Añadido a la cola', 'Added to queue'), v.title, 'done');
      },
    },
    {
      icon: I.settings,
      label: t('Descarga personalizada', 'Custom download'),
      onPick: () => {
        bus.emit('descargar:prefill', { urls: [v.url] });
        bus.emit('nav:goto', { view: 'descargar' });
      },
    },
  ]);
}

/**
 * Handler de "Descargar seleccionados": encola, navega a la cola y avisa.
 * `doneMsg` conserva el texto exacto de cada vista; `onDone` limpia la
 * selección y re-renderiza antes de navegar.
 */
export function downloadSelected(items: VideoMeta[], doneMsg: string, onDone: () => void): void {
  if (!items.length) return;
  enqueue(items.map(toQueueItem));
  onDone();
  bus.emit('nav:goto', { view: 'cola' });
  showToast(t('Añadido a la cola', 'Added to queue'), doneMsg, 'done');
}

/**
 * Handler de "Personalizar": manda las urls elegidas a la vista Descargar.
 * `onDone` limpia la selección y re-renderiza antes de navegar.
 */
export function customizeSelected(urls: string[], onDone: () => void): void {
  if (!urls.length) return;
  bus.emit('descargar:prefill', { urls });
  onDone();
  bus.emit('nav:goto', { view: 'descargar' });
  showToast(
    t('Personaliza tu descarga', 'Customize your download'),
    t(
      `${urls.length} ${urls.length === 1 ? 'video listo' : 'videos listos'} en Descargar.`,
      `${urls.length} ${urls.length === 1 ? 'video' : 'videos'} ready in Download.`,
    ),
    'info',
  );
}
