import { getSettings, setSettings } from '../settings.api';
import { getTheme, applyTheme, type Theme } from '../../../core/theme';
import { setDownloadDefaults } from '../../download';
import { checkDependencies } from '../../setup/setup.api';

const themeGroup = document.getElementById('set-theme') as HTMLElement;
const qualityGroup = document.getElementById('set-quality') as HTMLElement;
const containerGroup = document.getElementById('set-container') as HTMLElement;
const audioGroup = document.getElementById('set-audio') as HTMLElement;
const concurrencySel = document.getElementById('set-concurrency') as HTMLSelectElement;
const componentsEl = document.getElementById('set-components') as HTMLElement;
const descargarConcurrency = document.getElementById('concurrent-select') as HTMLSelectElement;

function activeVal(group: HTMLElement): string {
  return group.querySelector<HTMLElement>('.chip.is-active')?.dataset.val ?? '';
}

function selectChip(group: HTMLElement, val: string, attr: 'val' | 'theme' = 'val'): void {
  group.querySelectorAll<HTMLElement>('.chip').forEach((c) => {
    c.classList.toggle('is-active', c.dataset[attr] === val);
  });
}

async function save(): Promise<void> {
  const q = activeVal(qualityGroup);
  const c = activeVal(containerGroup);
  const a = activeVal(audioGroup);
  const conc = parseInt(concurrencySel.value, 10);
  await setSettings(q, c, a, conc);
  // Aplicar en caliente a la vista Descargar.
  setDownloadDefaults(q, c, a);
  descargarConcurrency.value = String(conc);
}

async function renderComponents(): Promise<void> {
  const d = await checkDependencies();
  const row = (name: string, ok: boolean) =>
    `<div class="set-comp"><span>${name}</span><span class="set-comp__badge set-comp__badge--${
      ok ? 'ok' : 'err'
    }">${ok ? 'Instalado' : 'Falta'}</span></div>`;
  componentsEl.innerHTML = row('yt-dlp', d.ytdlp) + row('ffmpeg', d.ffmpeg) + row('deno', d.deno);
}

export async function initSettings(): Promise<void> {
  const cfg = await getSettings();

  // Estado inicial de los controles
  selectChip(themeGroup, getTheme(), 'theme');
  selectChip(qualityGroup, cfg.default_quality);
  selectChip(containerGroup, cfg.default_container);
  selectChip(audioGroup, cfg.default_audio_format);
  concurrencySel.value = String(cfg.default_concurrency);

  // Aplicar defaults a la vista Descargar al arrancar
  setDownloadDefaults(cfg.default_quality, cfg.default_container, cfg.default_audio_format);
  descargarConcurrency.value = String(cfg.default_concurrency);

  // Wiring
  themeGroup.querySelectorAll<HTMLElement>('.chip').forEach((c) => {
    c.addEventListener('click', () => {
      const th = c.dataset.theme as Theme;
      applyTheme(th);
      selectChip(themeGroup, th, 'theme');
    });
  });
  [qualityGroup, containerGroup, audioGroup].forEach((g) => {
    g.querySelectorAll<HTMLElement>('.chip').forEach((c) => {
      c.addEventListener('click', () => {
        selectChip(g, c.dataset.val!);
        save();
      });
    });
  });
  concurrencySel.addEventListener('change', save);

  renderComponents();
}
