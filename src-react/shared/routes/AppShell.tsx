import { Outlet } from 'react-router-dom';
import { Box } from '@/shared/components/layout/Box';
import { Titlebar } from './Titlebar';
import { Sidebar } from './Sidebar';

/** One shell for every route: titlebar + sidebar + scrollable content. */
export const AppShell = () => (
  <Box className="flex h-screen flex-col overflow-hidden">
    <Titlebar />
    <Box className="flex min-h-0 flex-1">
      <Sidebar />
      <Box as="main" className="min-w-0 flex-1 overflow-y-auto bg-background">
        <Outlet />
      </Box>
    </Box>
  </Box>
);
