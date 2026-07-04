// Public facade of the download slice (pinned contract):
// Search / My YouTube prefill via useDownloadPrefill + navigate(AppPath.DESCARGAR).
// Pages are NOT exported: the router lazy-loads them by path to keep chunks split.
export { useDownloadPrefill } from './stores/useDownloadPrefill';
