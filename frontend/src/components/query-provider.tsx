'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // useState (not a plain module-level constant) ensures each user gets
  // their own QueryClient instance rather than one shared across
  // requests — the correct pattern to default to since it costs nothing
  // and avoids a real bug if this code path is ever touched by SSR.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Data here (problem lists/details) changes rarely; don't
            // refetch it just because the tab regained focus.
            refetchOnWindowFocus: false,
            staleTime: 30_000,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
