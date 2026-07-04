import { createHashRouter, Navigate } from 'react-router-dom';
import { AjustesPage } from '@/features/settings/pages/AjustesPage';
import { DescargarPage } from '@/features/download';
import { BibliotecaPage } from '@/features/library/pages/BibliotecaPage';
import { ColaPage } from '@/features/queue';
import { BuscarPage } from '@/features/search/pages/BuscarPage';
import { MiYoutubePage } from '@/features/youtube-account/pages/MiYoutubePage';
import { AppShell } from './AppShell';
import { AppPath } from './app-path';

// Hash router: the app is served from a local html file — no server-side routes.
export const router = createHashRouter([
  {
    element: <AppShell />,
    children: [
      { path: AppPath.ROOT, element: <Navigate to={AppPath.AJUSTES} replace /> },
      { path: AppPath.DESCARGAR, element: <DescargarPage /> },
      { path: AppPath.BUSCAR, element: <BuscarPage /> },
      { path: AppPath.YOUTUBE, element: <MiYoutubePage /> },
      { path: AppPath.COLA, element: <ColaPage /> },
      { path: AppPath.BIBLIOTECA, element: <BibliotecaPage /> },
      { path: AppPath.AJUSTES, element: <AjustesPage /> },
      { path: AppPath.ANY, element: <Navigate to={AppPath.AJUSTES} replace /> },
    ],
  },
]);
