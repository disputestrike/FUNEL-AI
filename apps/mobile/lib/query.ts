/**
 * React Query client — single instance shared across the app.
 *
 * Defaults tuned for a mobile, often-offline experience:
 *  - 2-minute stale time so quick re-opens don't re-fetch.
 *  - 30-minute gc time so backgrounded screens come back instantly.
 *  - One retry on failure (mobile networks flap).
 *  - Refetch on app foregrounding handled by useFocusEffect / AppState elsewhere.
 */
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      gcTime: 1000 * 60 * 30,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

export const queryKeys = {
  dashboard: ["dashboard"] as const,
  leads: (filter?: string) => ["leads", filter ?? "all"] as const,
  lead: (id: string) => ["lead", id] as const,
  funnels: ["funnels"] as const,
  funnel: (id: string) => ["funnel", id] as const,
  activity: ["activity"] as const,
  profile: ["profile"] as const,
};
