import { QueryClient } from '@tanstack/react-query';

/** Singleton so stores/event wiring can invalidate queries outside React. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Desktop app: no network flakiness to retry over, no tab refocus semantics.
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});
