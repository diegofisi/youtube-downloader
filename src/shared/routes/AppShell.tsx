import { Outlet } from 'react-router-dom';
import { Box } from '@/shared/components/layout/Box';
import { useQueueBridge } from '@/features/queue';
import { SessionExpiredBanner, useSilentReconnectOnExpiry } from '@/features/session';
import { Titlebar } from './Titlebar';
import { Sidebar } from './Sidebar';

// useQueueBridge keeps the download scheduler fed even when /cola is not mounted.
export const AppShell = () => {
  useQueueBridge();
  useSilentReconnectOnExpiry();

  return (
    <Box className="flex h-screen flex-col overflow-hidden">
      <Titlebar />
      <SessionExpiredBanner />
      <Box className="flex min-h-0 flex-1">
        <Sidebar />
        <Box as="main" className="min-w-0 flex-1 overflow-y-auto bg-background">
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
};
