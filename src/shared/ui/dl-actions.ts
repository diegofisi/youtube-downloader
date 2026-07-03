// Download actions shared by grid views (My YouTube / Search): default options, queue-item
// conversion, per-card menu, "Download selected" / "Customize" handlers. Uses only PUBLIC facades.
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

/** Flattens analyzeUrls output: expands playlists and drops entries without id. */
export function flatten(entries: AnalyzedEntry[]): VideoMeta[] {
  const out: VideoMeta[] = [];
  for (const e of entries) {
    if (e.is_playlist && 'entries' in e) out.push(...(e as PlaylistMeta).entries);
    else out.push(e as VideoMeta);
  }
  return out.filter((v) => v.id);
}

/** Default download options for the grids (max quality, MP4). */
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

/** Converts a grid VideoMeta into an item ready for enqueue(). */
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

/** Opens the "Download / Custom download" menu anchored to a card's ⬇ button. */
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

/** "Download selected" handler: enqueues, navigates to the queue and notifies. `doneMsg` keeps
 * each view's exact text; `onDone` clears the selection and re-renders before navigating. */
export function downloadSelected(items: VideoMeta[], doneMsg: string, onDone: () => void): void {
  if (!items.length) return;
  enqueue(items.map(toQueueItem));
  onDone();
  bus.emit('nav:goto', { view: 'cola' });
  showToast(t('Añadido a la cola', 'Added to queue'), doneMsg, 'done');
}

/** "Customize" handler: sends the chosen urls to the Download view.
 * `onDone` clears the selection and re-renders before navigating. */
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
