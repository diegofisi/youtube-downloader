import { I } from '../../../app/icons';
import { checkDependencies, downloadDependencies, onSetupProgress } from '../setup.api';

const $ = (id: string) => document.getElementById(id)!;

const STEPS = [
  { name: 'Preparando el descargador', desc: 'Listo para bajar videos de YouTube', icon: I.download },
  { name: 'Activando la alta calidad', desc: 'Video y audio en su mejor versión', icon: I.film },
  { name: 'Casi listo', desc: 'Dando los últimos toques', icon: I.spark },
];

function renderSteps(doneCount: number): void {
  $('onb-steps').innerHTML = STEPS.map((s, i) => {
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
  const finish = $('onb-finish') as HTMLButtonElement;
  const done = () => onb.hidden = true;
  finish.addEventListener('click', done);
  $('onb-skip').addEventListener('click', done);

  const status = await checkDependencies();
  if (status.ready && localStorage.getItem('stash-onboarded')) {
    onb.hidden = true;
    return;
  }
  localStorage.setItem('stash-onboarded', '1');
  onb.hidden = false;
  finish.disabled = true;
  finish.style.opacity = '.55';
  renderSteps(0);

  if (!status.ready) {
    let step = 0;
    onSetupProgress((d) => {
      if (d.step === 'ffmpeg') step = 1;
      else if (d.step === 'deno') step = 2;
      else if (d.step === 'done') step = 3;
      $('onb-detail').textContent = d.message;
      renderSteps(step);
    });
    try {
      await downloadDependencies();
      renderSteps(3);
    } catch (e) {
      $('onb-detail').textContent = `Error: ${String(e)}`;
    }
  } else {
    for (let i = 1; i <= 3; i++) {
      await sleep(520);
      renderSteps(i);
    }
  }
  $('onb-detail').textContent = '';
  finish.disabled = false;
  finish.style.opacity = '1';
}
