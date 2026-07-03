import { I } from '../../../shared/ui/icons';
import { t } from '../../../core/i18n';
import { $ } from '../../../shared/ui/dom';
import { checkDependencies, downloadDependencies, onSetupProgress } from '../setup.api';

// Perezoso (función, no constante) para no depender del orden de import de i18n.
const getSteps = () => [
  {
    name: t('Preparando el descargador', 'Setting up the downloader'),
    desc: t('Listo para bajar videos de YouTube', 'Ready to download YouTube videos'),
    icon: I.download,
  },
  {
    name: t('Activando la alta calidad', 'Enabling high quality'),
    desc: t('Video y audio en su mejor versión', 'Video and audio at their best'),
    icon: I.film,
  },
  {
    name: t('Casi listo', 'Almost ready'),
    desc: t('Dando los últimos toques', 'Adding the finishing touches'),
    icon: I.spark,
  },
];

function renderSteps(doneCount: number): void {
  $('onb-steps').innerHTML = getSteps().map((s, i) => {
    const done = i < doneCount;
    const active = i === doneCount;
    const statusEl = done
      ? `<span style="width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:var(--success);color:#04140C">${I.check}</span>`
      : active
        ? `<span style="color:var(--accent);display:flex">${I.spinner}</span>`
        : `<span style="width:8px;height:8px;border-radius:50%;background:var(--border2)"></span>`;
    return `<div style="display:flex;align-items:center;gap:13px;padding:13px 15px;background:var(--panel);border:1px solid var(--border);border-radius:13px">
      <span style="width:30px;height:30px;flex:none;border-radius:9px;display:flex;align-items:center;justify-content:center;background:var(--panel2);color:${done ? 'var(--success)' : 'var(--text2)'}">${s.icon}</span>
      <div style="flex:1;min-width:0"><div style="font-weight:600;font-size:13.5px">${s.name}</div><div style="font-size:11.5px;color:var(--text2)">${s.desc}</div></div>
      ${statusEl}
    </div>`;
  }).join('');
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function initOnboarding(): Promise<void> {
  const onb = $('onboarding');
  const finish = $<HTMLButtonElement>('onb-finish');
  const done = () => (onb.hidden = true);
  // En modo error el botón pasa a "Reintentar" y relanza la instalación en vez de cerrar.
  let retryMode = false;
  finish.addEventListener('click', () => {
    if (retryMode) {
      retryMode = false;
      runInstall();
    } else {
      done();
    }
  });
  $('onb-skip').addEventListener('click', done);

  const setFinishEnabled = (on: boolean) => {
    finish.disabled = !on;
    finish.style.opacity = on ? '1' : '.55';
  };

  async function runInstall(): Promise<void> {
    setFinishEnabled(false);
    finish.textContent = t('Empezar a usar Stash', 'Start using Stash');
    $('onb-detail').textContent = '';
    renderSteps(0);
    let step = 0;
    // Guardar el unlisten para no dejar el listener de Tauri vivo toda la sesión.
    const unlisten = await onSetupProgress((d) => {
      if (d.step === 'ffmpeg') step = 1;
      else if (d.step === 'deno') step = 2;
      else if (d.step === 'done') step = 3;
      $('onb-detail').textContent = d.message;
      renderSteps(step);
    });
    try {
      await downloadDependencies();
      renderSteps(3);
      $('onb-detail').textContent = '';
      setFinishEnabled(true);
    } catch (e) {
      // Dejar el error visible y ofrecer reintentar; no continuar como si todo hubiera ido bien.
      $('onb-detail').textContent = `${t('Error', 'Error')}: ${String(e)}`;
      finish.textContent = t('Reintentar', 'Retry');
      retryMode = true;
      setFinishEnabled(true);
    } finally {
      unlisten();
    }
  }

  const status = await checkDependencies();
  if (status.ready && localStorage.getItem('stash-onboarded')) {
    onb.hidden = true;
    return;
  }
  localStorage.setItem('stash-onboarded', '1');
  onb.hidden = false;
  setFinishEnabled(false);
  renderSteps(0);

  if (!status.ready) {
    await runInstall();
  } else {
    for (let i = 1; i <= 3; i++) {
      await sleep(520);
      renderSteps(i);
    }
    $('onb-detail').textContent = '';
    setFinishEnabled(true);
  }
}
