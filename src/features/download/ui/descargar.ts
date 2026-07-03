import { I } from '../../../shared/ui/icons';
import { esc } from '../../../shared/lib/html';
import { bus } from '../../../core/bus/event-bus';
import { t } from '../../../core/i18n';
import { showToast } from '../../../shared/ui/toast';
import { $ } from '../../../shared/ui/dom';
import { gradFor } from '../../../shared/ui/gradients';
import { renderChipGroup } from '../../../shared/ui/controls';
import { analyzeUrls, onPreviewProgress } from '../../preview';
import type { VideoMeta } from '../../preview';
import { getCookieMode } from '../../session';
import { getDownloadFolder, getSettings } from '../../settings';
import type { AppConfig } from '../../settings';
import { getHistory } from '../../library';
import { enqueue } from '../../queue';
import { applyDefaults, effectiveOpts, fmtDescription, opts, optsToBackend } from '../opts-model';
import type { Opts } from '../opts-model';
import {
  STATUS_META,
  allVideos,
  hasEntries,
  markDownloaded,
  refreshSummary,
  renderPreview,
  sel,
  setDownloadedSet,
  setEntries,
  setOnVideoOptsClick,
  statusOf,
  toggleOnlyDownloadable,
} from './preview-render';
import { closeVideoOpts, initVideoOptsModal, isVideoOptsOpen, openVideoOpts } from './video-opts-modal';
import { addRecentLinks, closeRecentPanel, initRecentLinks, isRecentPanelOpen, lineCountLabel } from './recent-links';

// Orquestador de la vista Descargar: opciones globales (tarjetas de modo y
// chips), analyze()/startDownload() y el wiring de botones y bus. El modelo
// vive en ../opts-model; la preview, el modal por-video y el panel Recientes
// en sus módulos hermanos.

// ---------- render options ----------
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

// ---------- download ----------
async function analyze(): Promise<void> {
  const urls = $<HTMLTextAreaElement>('url-input').value.split('\n').map((l) => l.trim()).filter((l) => l.startsWith('http'));
  if (urls.length === 0) {
    showToast(t('Sin enlaces', 'No links'), t('Pega al menos un enlace para previsualizar.', 'Paste at least one link to preview.'), 'warn');
    return;
  }
  const btn = $<HTMLButtonElement>('btn-analyze');
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
    setDownloadedSet(new Set(hist.flatMap((h) => (h.videoId ? [h.url, h.videoId] : [h.url]))));
    setEntries(await analyzeUrls(urls));
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
      $<HTMLTextAreaElement>('url-input').value = '';
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
    const eff = effectiveOpts(v.url);
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
  // Las tarjetas de la preview abren el modal por-video vía inyección (evita
  // el ciclo preview-render ⇄ video-opts-modal).
  setOnVideoOptsClick(openVideoOpts);

  renderModeCards();
  // La calidad repinta también la preview (los badges de tamaño dependen de ella).
  const paintQuality = () =>
    renderChipGroup('quality', [['max', t('Máxima', 'Max')], ['4k', '4K'], ['1440p', '1440p'], ['1080p', '1080p'], ['720p', '720p'], ['480p', '480p']], () => opts.quality, (v) => (opts.quality = v), { after: () => { renderPreview(); refreshSummary(); } });
  const paintContainer = () =>
    renderChipGroup('container', [['MP4', 'MP4'], ['MKV', 'MKV'], ['WebM', 'WebM']], () => opts.container, (v) => (opts.container = v), { after: refreshSummary });
  paintQuality();
  paintContainer();
  renderChipGroup('audioFmt', [['MP3', 'MP3'], ['M4A', 'M4A'], ['Opus', 'Opus']], () => opts.audioFmt, (v) => (opts.audioFmt = v), { after: refreshSummary });
  renderChipGroup('bitrate', [['128', '128'], ['192', '192'], ['256', '256'], ['320', '320']], () => opts.bitrate, (v) => (opts.bitrate = v), { after: refreshSummary });

  // Aplicar los defaults de Ajustes (el mapeo de valores vive en el modelo;
  // aquí solo se repinta la UI que depende de ellos).
  const applyDefaultsAndPaint = (cfg: AppConfig): void => {
    applyDefaults(cfg);
    $('video-opts').hidden = opts.mode === 'audio';
    $('audio-opts').hidden = opts.mode !== 'audio';
    renderModeCards();
    paintQuality();
    paintContainer();
    refreshSummary();
  };
  getSettings()
    .then((cfg) => applyDefaultsAndPaint(cfg))
    .catch(() => {});

  const urlInput = $<HTMLTextAreaElement>('url-input');
  urlInput.addEventListener('input', () => {
    const n = urlInput.value.split('\n').filter((l) => l.trim()).length;
    $('link-count').textContent = lineCountLabel(n);
  });

  $('btn-analyze').addEventListener('click', analyze);
  $('btn-download').addEventListener('click', startDownload);
  $('btn-go-youtube').addEventListener('click', () => bus.emit('nav:goto', { view: 'youtube' }));
  $('btn-filter-dl').addEventListener('click', () => {
    toggleOnlyDownloadable();
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
    if (!hasEntries())
      getSettings()
        .then((cfg) => applyDefaultsAndPaint(cfg))
        .catch(() => {});
  });

  initRecentLinks();
  initVideoOptsModal();

  // Escape con prioridad: primero el modal por-video, luego el panel Recientes.
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (isVideoOptsOpen()) closeVideoOpts(false);
    else if (isRecentPanelOpen()) closeRecentPanel();
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
    markDownloaded(url, videoId);
    if (hasEntries()) renderPreview();
  });

  refreshSummary();
}
