import { getTheme, applyTheme, type Theme } from '../../../core/theme';
import { getLang, setLang, t, type Lang } from '../../../core/i18n';
import { bus } from '../../../core/bus/event-bus';
import { invoke } from '../../../core/tauri/client';
import { getSettings, getDownloadFolder, changeDownloadFolder } from '../settings.api';
import type { AppConfig } from '../settings.types';
import { checkDependencies, downloadDependencies, onSetupProgress } from '../../setup/setup.api';
import type { DependencyStatus } from '../../setup/setup.types';
import { setConcurrency } from '../../queue';
import { showToast } from '../../../shared/ui/toast';
import { I, esc } from '../../../app/icons';
import type { UnlistenFn } from '../../../core/tauri/client';

const $ = (id: string) => document.getElementById(id)!;

const segStyle = (on: boolean) =>
  `padding:6px 15px;border-radius:7px;font-size:12.5px;font-weight:600;${
    on ? 'background:var(--panel);color:var(--text);box-shadow:0 1px 4px rgba(0,0,0,.25)' : 'color:var(--text2);background:transparent'
  }`;
const toggleStyle = (on: boolean) =>
  `width:38px;height:22px;flex:none;border-radius:12px;padding:2px;display:flex;background:${
    on ? 'var(--accent)' : 'var(--border2)'
  };justify-content:${on ? 'flex-end' : 'flex-start'};transition:all .18s`;
const knob = '<span style="width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.3)"></span>';
const chipStyle = (on: boolean) =>
  `padding:5px 11px;border-radius:8px;font-size:12px;font-weight:600;border:1.5px solid ${
    on ? 'var(--accent)' : 'var(--border)'
  };background:${on ? 'var(--accentSoft)' : 'transparent'};color:${on ? 'var(--accent)' : 'var(--text2)'}`;

function renderSeg(id: string, list: [string, string][], get: () => string, set: (v: string) => void): void {
  const el = $(id);
  el.innerHTML = list.map(([v, l]) => `<button data-val="${v}" style="${segStyle(v === get())}">${l}</button>`).join('');
  el.querySelectorAll<HTMLElement>('[data-val]').forEach((b) =>
    b.addEventListener('click', () => {
      set(b.dataset.val!);
      renderSeg(id, list, get, set);
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
  });
}
function renderChips(sel: string, list: [string, string][], get: () => string, set: (v: string) => void): void {
  const el = document.querySelector<HTMLElement>(`[data-group="${sel}"]`)!;
  el.innerHTML = list.map(([v, l]) => `<button data-val="${v}" style="${chipStyle(v === get())}">${l}</button>`).join('');
  el.querySelectorAll<HTMLElement>('[data-val]').forEach((b) =>
    b.addEventListener('click', () => {
      set(b.dataset.val!);
      renderChips(sel, list, get, set);
    }),
  );
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
  const btn = $('btn-repair') as HTMLButtonElement;
  if (d.ready) {
    st.innerHTML = `<span style="color:var(--success);display:flex;flex:none">${I.check}</span><span style="color:var(--text)">${esc(
      t('Todo funciona correctamente', 'Everything is working correctly'),
    )}</span>`;
    btn.style.borderColor = '';
    btn.style.color = '';
  } else {
    st.innerHTML = `<span style="color:var(--warn);display:flex;flex:none">${I.alert}</span><span style="color:var(--warn)">${esc(
      t('Faltan componentes necesarios — usa "Comprobar y reparar"', 'Required components are missing — use "Check & repair"'),
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
  const btn = $('btn-repair') as HTMLButtonElement;
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

  // Enviamos el set completo vía invoke (set_settings): setSettings de settings.api
  // aún expone solo los 4 campos antiguos; los args extra son inocuos si el
  // backend todavía no los declara.
  const save = () =>
    invoke('set_settings', {
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
  renderSeg('set-lang', [['es', 'Español'], ['en', 'English']], getLang, (v) => {
    setLang(v as Lang);
  });
  renderSeg('set-theme', [['dark', t('Oscuro', 'Dark')], ['light', t('Claro', 'Light')]], getTheme, (v) => {
    applyTheme(v as Theme);
    bus.emit('theme:changed', {});
  });
  renderSeg('set-concurrency', [['5', '5'], ['10', '10'], ['20', '20'], ['50', '50'], ['0', t('Todos', 'All')]], () => conc, (v) => {
    conc = v;
    setConcurrency(parseInt(v, 10));
    save();
  });
  renderChips('setQuality', [['auto', 'Auto'], ['max', t('Máx', 'Max')], ['2160', '4K'], ['1080', '1080p'], ['720', '720p'], ['480', '480p']], () => quality, (v) => {
    quality = v;
    save();
  });
  renderChips('setContainer', [['MP4', 'MP4'], ['MKV', 'MKV'], ['WEBM', 'WebM']], () => container, (v) => {
    container = v;
    save();
  });
  renderSeg('set-mode', [['video', t('Video + audio', 'Video + audio')], ['audio', t('Solo audio', 'Audio only')]], () => mode, (v) => {
    mode = v;
    save();
  });

  // Plantilla de nombre: guarda con debounce mientras se escribe y al perder foco
  const tpl = $('set-template') as HTMLInputElement;
  tpl.value = template;
  let tplTimer: number | undefined;
  tpl.addEventListener('input', () => {
    template = tpl.value;
    window.clearTimeout(tplTimer);
    tplTimer = window.setTimeout(save, 600);
  });
  tpl.addEventListener('blur', () => {
    window.clearTimeout(tplTimer);
    save();
  });

  renderToggle('set-subs', () => subs, (v) => {
    subs = v;
    save();
  });
  renderToggle('set-thumb', () => thumb, (v) => {
    thumb = v;
    save();
  });
  renderToggle('set-clear-links', () => clearLinks, (v) => {
    clearLinks = v;
    save();
  });

  // Carpeta de descargas
  getDownloadFolder().then((p) => ($('set-folder-path').textContent = p)).catch(() => {});
  $('set-change-folder').addEventListener('click', async () => {
    const p = await changeDownloadFolder();
    if (p) $('set-folder-path').textContent = p;
  });

  initTroubleshooting();
  refreshTroubleshooting().catch(() => {});
}
