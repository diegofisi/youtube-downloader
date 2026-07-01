import { initShell } from './app/shell';
import { initSetup } from './features/setup';
import { initCookiePanel } from './features/session';
import { initDownloadPanel, initOptionsPanel } from './features/download';
import { initPreviewPanel } from './features/preview';
import { initLibrary } from './features/library';
import { initFolderSettings } from './features/settings';

// El shell (titlebar, sidebar, router, tema) se monta de inmediato;
// el setup corre por encima como overlay hasta que las dependencias están listas.
initShell();

initSetup().then(() => {
  initCookiePanel();
  initOptionsPanel();
  initDownloadPanel();
  initPreviewPanel();
  initLibrary();
  initFolderSettings();
});
