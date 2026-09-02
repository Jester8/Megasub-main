import { InteractionManager } from 'react-native';
import { queryClient } from './queryClient';
import { queryKeys } from './queries';
import { fetchDashboard, fetchNetworks, fetchProducts, fetchTransactions } from './api';
import { toDateParam } from './transactionMeta';

const WINDOW_DAYS = 30;

let warming = false;

// Fired once right after login succeeds (email or Google — see login.jsx /
// lib/googleAuth.js) and again on a resumed session at app launch (App.js
// bootstrap). Pulls the core data every screen needs — wallet, networks,
// products, recent transactions — into the shared, disk-persisted query
// cache in the background, so by the time the user actually taps into Home,
// Wallet, or a buy screen, there's nothing to wait on. It's also what makes
// those screens usable at all on a dead connection: they read from this
// same cache, which survives regardless of what the network is doing right
// now.
export function warmAppData(userId) {
  if (!userId || warming) return;
  warming = true;

  const dateTo = new Date();
  const dateFrom = new Date();
  dateFrom.setDate(dateFrom.getDate() - WINDOW_DAYS);

  InteractionManager.runAfterInteractions(async () => {
    try {
      await Promise.allSettled([
        queryClient.prefetchQuery({
          queryKey: queryKeys.dashboard(userId),
          queryFn: () => fetchDashboard(userId),
        }),
        queryClient.prefetchQuery({
          queryKey: queryKeys.networks(userId),
          queryFn: () => fetchNetworks(userId),
        }),
        queryClient.prefetchQuery({
          queryKey: queryKeys.products(userId),
          queryFn: () => fetchProducts(userId),
        }),
        queryClient.prefetchQuery({
          queryKey: queryKeys.transactions(userId, toDateParam(dateFrom), toDateParam(dateTo)),
          queryFn: () =>
            fetchTransactions({ userId, dateFrom: toDateParam(dateFrom), dateTo: toDateParam(dateTo) }),
        }),
      ]);
    } finally {
      warming = false;
    }
  });
}
