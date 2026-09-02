import { AppState, Platform } from 'react-native';
import { QueryClient, focusManager } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';

// One shared cache for the whole app. Every screen reads server data through
// this client (see lib/queries.js) instead of its own useState/useEffect
// fetch, so data pulled by the login-time warm-up (lib/warmup.js) or by one
// screen is instantly available everywhere else, and — the actual point of
// this file — still there to read from when the network is down, since it's
// persisted to disk, not just kept in memory.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data younger than this is served straight from cache with no
      // network call at all; older data still paints instantly from cache
      // while a silent background refetch updates it in place.
      staleTime: 30 * 1000,
      // How long unused data stays in memory before React Query drops it.
      // The persisted copy on disk (below) is what actually survives app
      // restarts and low-network sessions; this just bounds RAM.
      gcTime: 24 * 60 * 60 * 1000,
      // A flaky connection is exactly what this exists to tolerate — one
      // retry before giving up and falling back to whatever's cached.
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Bump to invalidate every persisted cache entry after a breaking change to
// a query's data shape.
export const CACHE_BUSTER = 'v1';

// How long a persisted snapshot is trusted after the app was last used —
// also the hard cap on how stale disk data can get before it's dropped on
// restore instead of being shown as if it were current.
export const CACHE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

export const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'megasub-query-cache',
  // Batches rapid cache writes (e.g. the login warm-up firing several
  // queries at once) into one disk write instead of one per query.
  throttleTime: 2000,
});

// React Query only knows the app came back to the foreground if it's told —
// this is what makes a background-refetch-on-return actually happen on
// native, where there's no browser tab-focus event to hook into.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (status) => {
    focusManager.setFocused(status === 'active');
  });
}
