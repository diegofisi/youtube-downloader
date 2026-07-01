import { getTheme, applyTheme, type Theme } from '../../../core/theme';
import { getSettings, setSettings } from '../settings.api';
import { checkDependencies } from '../../setup/setup.api';
import { setConcurrency } from '../../queue';

const $ = (id: string) => document.getElementById(id)!;

const segStyle = (on: boolean) =>
  `padding:6px 15px;border-radius:7px;font-size:12.5px;font-weight:600;${
    on ? 'background:var(--panel);color:var(--text);box-shadow:0 1px 4px rgba(0,0,0,.25)' : 'color:var(--text2);background:transparent'
  }`;
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

async function renderComponents(): Promise<void> {
  const d = await checkDependencies();
  const row = (name: string, ok: boolean) =>
    `<div style="display:flex;align-items:center;justify-content:space-between;padding:13px 0;border-top:1px solid var(--border)"><span style="font-size:13.5px;font-family:'JetBrains Mono',monospace">${name}</span><span style="font-size:11px;font-weight:700;padding:3px 9px;border-radius:6px;color:${
      ok ? 'var(--success)' : 'var(--danger)'
    };background:${ok ? 'var(--successSoft)' : 'var(--dangerSoft)'}">${ok ? 'Instalado' : 'Falta'}</span></div>`;
  $('set-components').innerHTML = row('yt-dlp', d.ytdlp) + row('ffmpeg', d.ffmpeg) + row('deno', d.deno);
}

export async function initSettings(): Promise<void> {
  const cfg = await getSettings();
  let quality = cfg.default_quality || 'auto';
  let container = (cfg.default_container || 'mp4').toUpperCase();
  let conc = String(cfg.default_concurrency || 5);
  setConcurrency(cfg.default_concurrency || 5);

  const save = () =>
    setSettings(quality, container.toLowerCase(), cfg.default_audio_format || 'mp3', parseInt(conc, 10));

  renderSeg('set-theme', [['dark', 'Oscuro'], ['light', 'Claro']], getTheme, (v) => applyTheme(v as Theme));
  renderSeg('set-concurrency', [['5', '5'], ['10', '10'], ['20', '20'], ['50', '50'], ['0', 'Todos']], () => conc, (v) => {
    conc = v;
    setConcurrency(parseInt(v, 10));
    save();
  });
  renderChips('setQuality', [['auto', 'Auto'], ['max', 'Máx'], ['2160', '4K'], ['1080', '1080p'], ['720', '720p'], ['480', '480p']], () => quality, (v) => {
    quality = v;
    save();
  });
  renderChips('setContainer', [['MP4', 'MP4'], ['MKV', 'MKV'], ['WEBM', 'WebM']], () => container, (v) => {
    container = v;
    save();
  });

  renderComponents();
}
