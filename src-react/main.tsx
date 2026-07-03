import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { queryClient } from '@/shared/lib/query-client';
import { router } from '@/shared/routes/router';
import { Toaster } from '@/shared/components/ui/sonner';
import { applyTheme, useUiStore } from '@/shared/stores/useUiStore';
import '@/shared/styles/globals.css';

// Sync class + data-theme with the persisted choice before the first paint.
applyTheme(useUiStore.getState().theme);

const App = () => {
  const lang = useUiStore((s) => s.lang);
  // key remount re-evaluates every t() call — the cheapest correct live switch
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} key={lang} />
      <Toaster />
    </QueryClientProvider>
  );
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
