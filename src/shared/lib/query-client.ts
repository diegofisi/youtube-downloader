import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Desktop app: no network flakiness to retry over, no tab refocus semantics.
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});
