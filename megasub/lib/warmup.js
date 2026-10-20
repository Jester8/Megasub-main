import { InteractionManager, Platform } from 'react-native';
import { queryClient } from './queryClient';
import { queryKeys } from './queries';
import {
  fetchDashboard,
  fetchNetworks,
  fetchProducts,
  fetchTransactions,
  fetchProductPlanCategories,
  fetchProductPlans,
  fetchEsimCountries,
  fetchVirtualCardProducts,
  fetchResultCheckerProducts,
  fetchScheduledPurchases,
  fetchReferralSummary,
} from './api';
import { toDateParam } from './transactionMeta';

// Electricity's plan listing 403s without an amount placeholder — same
// workaround Electricity.js itself already uses.
const CATALOG_SLUGS = [
  { slug: 'cable_subscription', extraParams: {} },
  { slug: 'utility_bills', extraParams: { amount: 100 } },
];

async function fetchCatalog(userId, productSlug, extraParams) {
  const [categoriesJson, plansJson] = await Promise.all([
    fetchProductPlanCategories({ userId, productSlug }),
    fetchProductPlans({ userId, productSlug, ...extraParams }),
  ]);
  return { categories: categoriesJson.data || [], plans: plansJson.data || [] };
}

const WINDOW_DAYS = 62;

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
        // iOS only: one cheap call per optional V2 feature, so request()
        // reports which ones the server hasn't deployed and their tiles are
        // already hidden by the time Home renders (lib/featureAvailability.js).
        ...(Platform.OS === 'ios'
          ? [
              fetchEsimCountries(userId),
              fetchVirtualCardProducts(userId),
              fetchResultCheckerProducts(userId),
              fetchScheduledPurchases(userId),
              fetchReferralSummary(),
            ]
          : []),
        ...CATALOG_SLUGS.map(({ slug, extraParams }) =>
          queryClient.prefetchQuery({
            queryKey: queryKeys.catalog(userId, slug),
            queryFn: () => fetchCatalog(userId, slug, extraParams),
          })
        ),
      ]);
    } finally {
      warming = false;
    }
  });
}
