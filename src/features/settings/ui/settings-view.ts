import { getTheme, applyTheme, type Theme } from '../../../core/theme';
import { getLang, setLang, t, type Lang } from '../../../core/i18n';
import { bus } from '../../../core/bus/event-bus';
import { getSettings, setSettings, getDownloadFolder, changeDownloadFolder } from '../settings.api';
import { checkDependencies, downloadDependencies, onSetupProgress } from '../../setup';
import type { DependencyStatus, UnlistenFn } from '../../setup';
import { setConcurrency } from '../../queue';
import { showToast } from '../../../shared/ui/toast';
import { I } from '../../../shared/ui/icons';
import { esc } from '../../../shared/lib/html';
import { $ } from '../../../shared/ui/dom';
import { renderChipGroup, renderSeg, renderToggle } from '../../../shared/ui/controls';

/** Chips de Ajustes: variante compacta (padding 5px 11px). */
function renderChips(sel: string, list: [string, string][], get: () => string, set: (v: string) => void): void {
  renderChipGroup(sel, list, get, set, { pad: '5px 11px' });
}

function renderComponents(d: DependencyStatus): void {
  const row = (name: string, ok: boolean) =>
    `<div style="display:flex;align-items:center;justify-content:space-between;padding:13px 0;border-top:1px solid var(--border)"><span style="font-size:13.5px;font-family:'JetBrains Mono',monospace">${name}</span><span style="font-size:11px;font-weight:700;padding:3px 9px;border-radius:6px;color:${
      ok ? 'var(--success)' : 'var(--danger)'
    };background:${ok ? 'var(--successSoft)' : 'var(--dangerSoft)'}">${ok ? t('Instalado', 'Installed') : t('Falta', 'Missing')}</span></div>`;
  $('set-components').innerHTML = row('yt-dlp', d.ytdlp) + row('ffmpeg', d.ffmpeg) + row('deno', d.deno);
}

function renderFixStatus(d: DependencyStatus): void {
  const st = $('fix-status');
  const btn = $<HTMLButtonElement>('btn-repair');
  if (d.ready) {
    st.innerHTML = `<span style="color:var(--success);display:flex;flex:none">${I.check}</span><span style="color:var(--text)">${esc(
      t('Todo funciona correctamente', 'Everything is working correctly'),
    )}</span>`;
    btn.style.borderColor = '';
    btn.style.color = '';
  } else {
    st.innerHTML = `<span style="color:var(--warn);display:flex;flex:none">${I.alert}</span><span style="color:var(--warn)">${esc(
      t(
        'Faltan componentes necesarios — usa "Comprobar y reparar"',
        'Required components are missing — use "Check & repair"',
      ),
    )}</span>`;
    // Resalta el botón cuando falta algo.
    btn.style.borderColor = 'var(--warn)';
    btn.style.color = 'var(--warn)';
  }
}

/** Re-ejecuta la comprobación y repinta el estado amigable + la lista técnica. */
async function refreshTroubleshooting(): Promise<void> {
  const d = await checkDependencies();
  renderFixStatus(d);
  renderComponents(d);
}

function initTroubleshooting(): void {
  const btn = $<HTMLButtonElement>('btn-repair');
  const prog = $('fix-progress');
  let repairing = false;

  btn.addEventListener('click', async () => {
    if (repairing) return; // protege contra doble click
    repairing = true;
    btn.disabled = true;
    btn.style.opacity = '.55';
    btn.textContent = t('Reparando…', 'Repairing…');
    prog.hidden = false;
    prog.textContent = '';

    let unlisten: UnlistenFn | null = null;
    try {
      unlisten = await onSetupProgress((p) => {
        const pct = Math.min(100, Math.max(0, p.percent));
        prog.innerHTML =
          `<div style="display:flex;justify-content:space-between;gap:10px;margin-bottom:6px"><span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.message)}</span><span style="flex:none;font-family:'JetBrains Mono',monospace">${Math.round(pct)}%</span></div>` +
          `<div style="height:4px;border-radius:2px;background:var(--border)"><div style="height:100%;width:${pct}%;border-radius:2px;background:var(--accent);transition:width .2s"></div></div>`;
      });
      await downloadDependencies();
      prog.hidden = true;
      prog.textContent = '';
      showToast(t('Reparación completada', 'Repair completed'), '', 'done');
    } catch (e) {
      // Dejar el error visible en el panel (no se borra) además del toast.
      prog.hidden = false;
      prog.innerHTML = `<span style="color:var(--danger)">${esc(`${t('Error', 'Error')}: ${String(e)}`)}</span>`;
      showToast(t('Error al reparar', 'Repair failed'), String(e), 'error');
    } finally {
      if (unlisten) unlisten();
      await refreshTroubleshooting().catch(() => {});
      btn.disabled = false;
      btn.style.opacity = '1';
      btn.textContent = t('Comprobar y reparar', 'Check & repair');
      repairing = false;
    }
  });
}

export async function initSettings(): Promise<void> {
  const cfg = await getSettings();
  let quality = cfg.default_quality || 'auto';
  let container = (cfg.default_container || 'mp4').toUpperCase();
  let conc = String(cfg.default_concurrency ?? 5);
  let mode = cfg.default_mode ?? 'video';
  let template = cfg.default_template ?? '%(title)s [%(id)s]';
  let subs = cfg.default_subtitles ?? false;
  let thumb = cfg.default_thumbnail ?? true;
  let clearLinks = cfg.clear_links_after_preview ?? true;
  setConcurrency(cfg.default_concurrency ?? 5);

  const save = () =>
    setSettings({
      defaultQuality: quality,
      defaultContainer: container.toLowerCase(),
      defaultAudioFormat: cfg.default_audio_format || 'mp3',
      defaultConcurrency: parseInt(conc, 10),
      defaultMode: mode,
      defaultTemplate: template,
      defaultSubtitles: subs,
      defaultThumbnail: thumb,
      clearLinksAfterPreview: clearLinks,
    });

  // Idioma: setLang persiste y recarga la app (el aviso está en la fila del HTML)
  renderSeg(
    'set-lang',
    [
      ['es', 'Español'],
      ['en', 'English'],
    ],
    getLang,
    (v) => {
      setLang(v as Lang);
    },
  );
  renderSeg(
    'set-theme',
    [
      ['dark', t('Oscuro', 'Dark')],
      ['light', t('Claro', 'Light')],
    ],
    getTheme,
    (v) => {
      applyTheme(v as Theme);
      bus.emit('theme:changed');
    },
  );
  renderSeg(
    'set-concurrency',
    [
      ['5', '5'],
      ['10', '10'],
      ['20', '20'],
      ['50', '50'],
      ['0', t('Todos', 'All')],
    ],
    () => conc,
    (v) => {
      conc = v;
      setConcurrency(parseInt(v, 10));
      void save();
    },
  );
  renderChips(
    'setQuality',
    [
      ['auto', 'Auto'],
      ['max', t('Máx', 'Max')],
      ['2160', '4K'],
      ['1080', '1080p'],
      ['720', '720p'],
      ['480', '480p'],
    ],
    () => quality,
    (v) => {
      quality = v;
      void save();
    },
  );
  renderChips(
    'setContainer',
    [
      ['MP4', 'MP4'],
      ['MKV', 'MKV'],
      ['WEBM', 'WebM'],
    ],
    () => container,
    (v) => {
      container = v;
      void save();
    },
  );
  renderSeg(
    'set-mode',
    [
      ['video', t('Video + audio', 'Video + audio')],
      ['audio', t('Solo audio', 'Audio only')],
    ],
    () => mode,
    (v) => {
      mode = v;
      void save();
    },
  );

  // Plantilla de nombre: guarda con debounce mientras se escribe y al perder foco
  const tpl = $<HTMLInputElement>('set-template');
  tpl.value = template;
  let tplTimer: number | undefined;
  tpl.addEventListener('input', () => {
    template = tpl.value;
    window.clearTimeout(tplTimer);
    tplTimer = window.setTimeout(save, 600);
  });
  tpl.addEventListener('blur', () => {
    window.clearTimeout(tplTimer);
    void save();
  });

  renderToggle(
    'set-subs',
    () => subs,
    (v) => {
      subs = v;
      void save();
    },
  );
  renderToggle(
    'set-thumb',
    () => thumb,
    (v) => {
      thumb = v;
      void save();
    },
  );
  renderToggle(
    'set-clear-links',
    () => clearLinks,
    (v) => {
      clearLinks = v;
      void save();
    },
  );

  // Carpeta de descargas
  getDownloadFolder()
    .then((p) => ($('set-folder-path').textContent = p))
    .catch(() => {});
  $('set-change-folder').addEventListener('click', async () => {
    const p = await changeDownloadFolder();
    if (p) $('set-folder-path').textContent = p;
  });

  initTroubleshooting();
  refreshTroubleshooting().catch(() => {});
}
