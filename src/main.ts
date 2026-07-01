import { initShell } from './app/shell';
import { initSession } from './features/session';
import { initOnboarding } from './features/setup/ui/onboarding';
import { initDescargar } from './features/download/ui/descargar';
import { initQueueView } from './features/queue';
import { initAccount } from './features/youtube-account';
import { initLibrary } from './features/library';
import { initSettings } from './features/settings/ui/settings-view';

initShell();
initSession();
initQueueView();
initDescargar();
initAccount();
initLibrary();
initSettings();
initOnboarding();
