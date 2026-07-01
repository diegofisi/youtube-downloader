import { checkDependencies, downloadDependencies, onSetupProgress } from '../setup.api';

const setupScreen = document.getElementById('setup-screen')!;
const setupMessage = document.getElementById('setup-message')!;
const setupBar = document.getElementById('setup-bar')!;
const setupDetail = document.getElementById('setup-detail')!;
const setupError = document.getElementById('setup-error')!;
const setupRetry = document.getElementById('setup-retry')!;

/** Muestra el overlay de setup hasta que las dependencias están listas. */
export async function initSetup(): Promise<boolean> {
  const status = await checkDependencies();

  if (status.ready) {
    setupScreen.style.display = 'none';
    return true;
  }

  setupScreen.style.display = 'flex';
  await runSetup();
  return true;
}

async function runSetup(): Promise<void> {
  setupMessage.textContent = 'Configurando componentes necesarios...';
  setupError.style.display = 'none';
  setupRetry.style.display = 'none';
  setupBar.style.width = '0%';
  setupDetail.textContent = 'Preparando...';

  const unlisten = await onSetupProgress((data) => {
    setupDetail.textContent = data.message;

    if (data.step === 'yt-dlp') {
      setupMessage.textContent = 'Descargando motor de descargas...';
      setupBar.style.width = `${Math.min(data.percent / 3, 30)}%`;
    } else if (data.step === 'ffmpeg') {
      setupMessage.textContent = 'Descargando procesador de video...';
      setupBar.style.width = `${30 + Math.min(data.percent / 3, 30)}%`;
    } else if (data.step === 'deno') {
      setupMessage.textContent = 'Descargando runtime JavaScript...';
      setupBar.style.width = `${60 + Math.min(data.percent / 3, 30)}%`;
    } else if (data.step === 'done') {
      setupMessage.textContent = 'Todo listo!';
      setupBar.style.width = '100%';
    }
  });

  try {
    await downloadDependencies();
    unlisten();
    await new Promise((r) => setTimeout(r, 800));
    setupScreen.style.display = 'none';
  } catch (err) {
    unlisten();
    setupMessage.textContent = 'Error durante la configuración';
    setupDetail.textContent = '';
    setupError.textContent = String(err);
    setupError.style.display = 'block';
    setupRetry.style.display = 'inline-flex';
  }
}

setupRetry.addEventListener('click', () => {
  runSetup();
});
