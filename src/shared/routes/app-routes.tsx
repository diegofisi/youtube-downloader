import { lazy, Suspense, type ComponentType } from 'react';
import { PageLoading } from '@/shared/components/ui/PageLoading';
import { AppPath } from './app-path';

type LoadPage = () => Promise<{ default: ComponentType }>;

function route(path: string, load: LoadPage) {
  const Page = lazy(load);
  return {
    path,
    element: (
      <Suspense fallback={<PageLoading />}>
        <Page />
      </Suspense>
    ),
  };
}

// Single source of truth for what pages exist; add a page by adding one line.
export const appRoutes = [
  route(AppPath.DESCARGAR, () => import('@/features/download/pages/DescargarPage').then((m) => ({ default: m.DescargarPage }))),
  route(AppPath.BUSCAR, () => import('@/features/search/pages/BuscarPage').then((m) => ({ default: m.BuscarPage }))),
  route(AppPath.YOUTUBE, () => import('@/features/youtube-account/pages/MiYoutubePage').then((m) => ({ default: m.MiYoutubePage }))),
  route(AppPath.COLA, () => import('@/features/queue/pages/ColaPage').then((m) => ({ default: m.ColaPage }))),
  route(AppPath.BIBLIOTECA, () => import('@/features/library/pages/BibliotecaPage').then((m) => ({ default: m.BibliotecaPage }))),
  route(AppPath.AJUSTES, () => import('@/features/settings/pages/AjustesPage').then((m) => ({ default: m.AjustesPage }))),
];
