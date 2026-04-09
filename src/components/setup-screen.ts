import { checkDependencies, downloadDependencies, onSetupProgress } from '../services/tauri-api';

const setupScreen = document.getElementById('setup-screen')!;
const appContent = document.getElementById('app')!;
const setupMessage = document.getElementById('setup-message')!;
const setupBar = document.getElementById('setup-bar')!;
const setupDetail = document.getElementById('setup-detail')!;
const setupError = document.getElementById('setup-error')!;
const setupRetry = document.getElementById('setup-retry')!;

export async function initSetup(): Promise<boolean> {
  const status = await checkDependencies();

  if (status.ready) {
    // Dependencies exist, show app directly
    setupScreen.style.display = 'none';
    appContent.style.display = 'block';
    return true;
  }

  // Show setup screen, hide app
  setupScreen.style.display = 'flex';
  appContent.style.display = 'none';

  await runSetup();
  return true;
}

async function runSetup() {
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

    // Brief pause to show completion
    await new Promise((r) => setTimeout(r, 800));

    // Transition to app
    setupScreen.style.display = 'none';
    appContent.style.display = 'block';
  } catch (err) {
    unlisten();
    setupMessage.textContent = 'Error durante la configuración';
    setupDetail.textContent = '';
    setupError.textContent = String(err);
    setupError.style.display = 'block';
    setupRetry.style.display = 'inline-flex';
  }
}

// Retry button
document.getElementById('setup-retry')?.addEventListener('click', () => {
  runSetup();
});
