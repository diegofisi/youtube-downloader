import { openDownloadsFolder, getDownloadFolder, changeDownloadFolder } from './services/tauri-api';
import { initCookiePanel } from './components/cookie-panel';
import { initDownloadPanel } from './components/download-panel';
import { initSetup } from './components/setup-screen';
import { initShell } from './app/shell';

// El shell (titlebar, sidebar, router, tema) se monta de inmediato;
// el setup corre por encima como overlay hasta que las dependencias están listas.
initShell();

initSetup().then(() => {
  const folderPathEl = document.getElementById('folder-path')!;

  // Paneles existentes (se migrarán a features/ en la Fase 1)
  initCookiePanel();
  initDownloadPanel();

  // Carpeta de descargas actual
  getDownloadFolder().then((path) => {
    folderPathEl.textContent = path;
    folderPathEl.title = path;
  });

  document.getElementById('open-folder')!.addEventListener('click', (e) => {
    e.preventDefault();
    openDownloadsFolder();
  });

  document.getElementById('change-folder')!.addEventListener('click', async (e) => {
    e.preventDefault();
    const newPath = await changeDownloadFolder();
    if (newPath) {
      folderPathEl.textContent = newPath;
      folderPathEl.title = newPath;
    }
  });
});
