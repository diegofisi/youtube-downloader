import { openDownloadsFolder, getDownloadFolder, changeDownloadFolder } from '../settings.api';

/** Conecta la fila de carpeta de descargas (mostrar/abrir/cambiar). */
export function initFolderSettings(): void {
  const folderPathEl = document.getElementById('folder-path')!;

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
}
