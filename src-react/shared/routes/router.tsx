import { createHashRouter, Navigate } from 'react-router-dom';
import { AjustesPage } from '@/features/settings/pages/AjustesPage';
import { AppShell } from './AppShell';
import { AppPath } from './app-path';
import { PlaceholderPage } from './PlaceholderPage';

// Hash router: the app is served from a local html file — no server-side routes.
export const router = createHashRouter([
  {
    element: <AppShell />,
    children: [
      { path: AppPath.ROOT, element: <Navigate to={AppPath.AJUSTES} replace /> },
      { path: AppPath.DESCARGAR, element: <PlaceholderPage es="Descargar" en="Download" /> },
      { path: AppPath.BUSCAR, element: <PlaceholderPage es="Buscar" en="Search" /> },
      { path: AppPath.YOUTUBE, element: <PlaceholderPage es="Mi YouTube" en="My YouTube" /> },
      { path: AppPath.COLA, element: <PlaceholderPage es="Cola" en="Queue" /> },
      { path: AppPath.BIBLIOTECA, element: <PlaceholderPage es="Biblioteca" en="Library" /> },
      { path: AppPath.AJUSTES, element: <AjustesPage /> },
      { path: AppPath.ANY, element: <Navigate to={AppPath.AJUSTES} replace /> },
    ],
  },
]);
