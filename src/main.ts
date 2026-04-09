import { openDownloadsFolder, getDownloadFolder, changeDownloadFolder } from './services/tauri-api';
import { initCookiePanel } from './components/cookie-panel';
import { initDownloadPanel } from './components/download-panel';
import { initSetup } from './components/setup-screen';

// Run setup first, then initialize app
initSetup().then(() => {
  const folderPathEl = document.getElementById('folder-path')!;

  // Initialize all panels
  initCookiePanel();
  initDownloadPanel();

  // Show current download folder
  getDownloadFolder().then((path) => {
    folderPathEl.textContent = path;
    folderPathEl.title = path;
  });

  // Open downloads folder link
  document.getElementById('open-folder')!.addEventListener('click', (e) => {
    e.preventDefault();
    openDownloadsFolder();
  });

  // Change downloads folder
  document.getElementById('change-folder')!.addEventListener('click', async (e) => {
    e.preventDefault();
    const newPath = await changeDownloadFolder();
    if (newPath) {
      folderPathEl.textContent = newPath;
      folderPathEl.title = newPath;
    }
  });
});
