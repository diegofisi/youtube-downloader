import { createHashRouter, Navigate } from 'react-router-dom';
import { AppShell } from './AppShell';
import { AppPath } from './app-path';
import { appRoutes } from './app-routes';

const toHome = <Navigate to={AppPath.DESCARGAR} replace />;

// Hash router: served from a local html file, so no server-side routes.
export const router = createHashRouter([
  {
    element: <AppShell />,
    children: [
      { path: AppPath.ROOT, element: toHome },
      ...appRoutes,
      { path: AppPath.ANY, element: toHome },
    ],
  },
]);
