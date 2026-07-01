import type { DownloadOptions } from '../download.types';

const opts: DownloadOptions = {
  mode: 'video',
  quality: 'auto',
  container: 'mp4',
  audioFormat: 'mp3',
  audioBitrate: 0,
  subtitles: false,
  subLangs: 'es,en',
  embedThumbnail: false,
  outputTemplate: undefined,
  cookieMode: 'none',
};

/** Devuelve una copia de las opciones actuales (cookieMode lo fija quien descarga). */
export function getDownloadOptions(): DownloadOptions {
  return { ...opts };
}

function selectChip(group: HTMLElement, val: string): void {
  group.querySelectorAll<HTMLButtonElement>('.chip, .seg').forEach((b) => {
    b.classList.toggle('is-active', b.dataset.val === val);
  });
}

/** Aplica defaults (desde Ajustes) al estado y a los chips activos. */
export function setDownloadDefaults(quality: string, container: string, audioFormat: string): void {
  opts.quality = quality;
  opts.container = container as DownloadOptions['container'];
  opts.audioFormat = audioFormat as DownloadOptions['audioFormat'];
  const setGroup = (g: string, v: string) => {
    const el = document.querySelector<HTMLElement>(`[data-group="${g}"]`);
    if (el) selectChip(el, v);
  };
  setGroup('quality', quality);
  setGroup('container', container);
  setGroup('audioFormat', audioFormat);
}

export function initOptionsPanel(): void {
  const videoOpts = document.getElementById('video-opts') as HTMLElement;
  const audioOpts = document.getElementById('audio-opts') as HTMLElement;

  document.querySelectorAll<HTMLElement>('[data-group]').forEach((group) => {
    const key = group.dataset.group!;
    group.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.chip, .seg');
      if (!btn) return;
      const val = btn.dataset.val!;
      selectChip(group, val);

      switch (key) {
        case 'mode':
          opts.mode = val as DownloadOptions['mode'];
          videoOpts.style.display = val === 'video' ? '' : 'none';
          audioOpts.style.display = val === 'audio' ? '' : 'none';
          break;
        case 'quality':
          opts.quality = val;
          break;
        case 'container':
          opts.container = val as DownloadOptions['container'];
          break;
        case 'audioFormat':
          opts.audioFormat = val as DownloadOptions['audioFormat'];
          break;
        case 'audioBitrate':
          opts.audioBitrate = parseInt(val, 10);
          break;
      }
    });
  });

  const subs = document.getElementById('opt-subs') as HTMLInputElement;
  const thumb = document.getElementById('opt-thumb') as HTMLInputElement;
  const template = document.getElementById('opt-template') as HTMLInputElement;

  subs.addEventListener('change', () => (opts.subtitles = subs.checked));
  thumb.addEventListener('change', () => (opts.embedThumbnail = thumb.checked));
  template.addEventListener('input', () => {
    opts.outputTemplate = template.value.trim() || undefined;
  });
}
