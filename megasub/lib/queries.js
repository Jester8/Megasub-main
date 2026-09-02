import { useQuery } from '@tanstack/react-query';
import { fetchDashboard, fetchNetworks, fetchProducts, fetchTransactions } from './api';

// Every server dataset the app shows lives under one of these keys, in the
// one shared queryClient (lib/queryClient.js). lib/warmup.js prefetches
// these exact keys right after login, so screens mounting later find their
// data already cached — including with no network at all, since the cache
// is persisted to disk (see queryClient.js's asyncStoragePersister).
//
// staleTime is how long a revisit is served straight from cache with zero
// network call. Networks/products barely change day to day; the wallet
// balance and transaction list are worth checking more often since they
// change with every purchase.
export const STALE_TIMES = {
  dashboard: 30_000, // 30s
  networks: 60 * 60_000, // 1hr
  products: 60 * 60_000, // 1hr
  transactions: 60_000, // 60s
};

export const queryKeys = {
  dashboard: (userId) => ['dashboard', userId],
  networks: (userId) => ['networks', userId],
  products: (userId) => ['products', userId],
  transactions: (userId, dateFrom, dateTo) => ['transactions', userId, dateFrom ?? '', dateTo ?? ''],
};

// /dashboard's top-level `data` carries stale/blank profile fields — the
// real account (including main_wallet) is nested under data.user, same
// quirk App.js's own refreshWallet() already works around.
export function useDashboard(userId) {
  return useQuery({
    queryKey: queryKeys.dashboard(userId),
    queryFn: () => fetchDashboard(userId),
    enabled: !!userId,
    staleTime: STALE_TIMES.dashboard,
    select: (json) => json?.data?.user ?? null,
  });
}

export function useNetworksQuery(userId) {
  return useQuery({
    queryKey: queryKeys.networks(userId),
    queryFn: () => fetchNetworks(userId),
    enabled: !!userId,
    staleTime: STALE_TIMES.networks,
    select: (json) => json?.data ?? [],
  });
}

export function useProductsQuery(userId) {
  return useQuery({
    queryKey: queryKeys.products(userId),
    queryFn: () => fetchProducts(userId),
    enabled: !!userId,
    staleTime: STALE_TIMES.products,
    select: (json) => json?.data ?? [],
  });
}

export function useTransactionsQuery(userId, { dateFrom, dateTo } = {}) {
  return useQuery({
    queryKey: queryKeys.transactions(userId, dateFrom, dateTo),
    queryFn: () => fetchTransactions({ userId, dateFrom, dateTo }),
    enabled: !!userId,
    staleTime: STALE_TIMES.transactions,
    select: (json) => json?.data ?? [],
  });
}
