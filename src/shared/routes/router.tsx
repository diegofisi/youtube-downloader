import { lazy, Suspense, type ReactNode } from 'react';
import { createHashRouter, Navigate } from 'react-router-dom';
import { PageLoading } from '@/shared/components/ui/PageLoading';
import { AppShell } from './AppShell';
import { AppPath } from './app-path';

// Route-level code splitting: each page chunk loads on first visit.
const DescargarPage = lazy(() =>
  import('@/features/download/pages/DescargarPage').then((m) => ({ default: m.DescargarPage })),
);
const BuscarPage = lazy(() => import('@/features/search/pages/BuscarPage').then((m) => ({ default: m.BuscarPage })));
const MiYoutubePage = lazy(() =>
  import('@/features/youtube-account/pages/MiYoutubePage').then((m) => ({
    default: m.MiYoutubePage,
  })),
);
const ColaPage = lazy(() => import('@/features/queue/pages/ColaPage').then((m) => ({ default: m.ColaPage })));
const BibliotecaPage = lazy(() =>
  import('@/features/library/pages/BibliotecaPage').then((m) => ({ default: m.BibliotecaPage })),
);
const AjustesPage = lazy(() =>
  import('@/features/settings/pages/AjustesPage').then((m) => ({ default: m.AjustesPage })),
);

const page = (element: ReactNode) => <Suspense fallback={<PageLoading />}>{element}</Suspense>;

// Hash router: the app is served from a local html file — no server-side routes.
export const router = createHashRouter([
  {
    element: <AppShell />,
    children: [
      { path: AppPath.ROOT, element: <Navigate to={AppPath.DESCARGAR} replace /> },
      { path: AppPath.DESCARGAR, element: page(<DescargarPage />) },
      { path: AppPath.BUSCAR, element: page(<BuscarPage />) },
      { path: AppPath.YOUTUBE, element: page(<MiYoutubePage />) },
      { path: AppPath.COLA, element: page(<ColaPage />) },
      { path: AppPath.BIBLIOTECA, element: page(<BibliotecaPage />) },
      { path: AppPath.AJUSTES, element: page(<AjustesPage />) },
      { path: AppPath.ANY, element: <Navigate to={AppPath.DESCARGAR} replace /> },
    ],
  },
]);
