import * as SecureStore from 'expo-secure-store';

// Matches the BASE_URL already used by login.jsx / signup.jsx / verify.jsx.
export const BASE_URL = 'https://mega-sub.com/api/v1/external';
const SESSION_KEY = 'megasub_session_token';

function buildQuery(params) {
  const entries = Object.entries(params || {}).filter(
    ([, value]) => value !== undefined && value !== null && value !== ''
  );
  if (entries.length === 0) return '';
  return '?' + entries.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join('&');
}

// This API always responds with HTTP 200 and signals success/failure through
// the JSON `status` field, so response.ok alone can't be trusted.
async function request(path, { method = 'GET', body, params } = {}) {
  const token = await SecureStore.getItemAsync(SESSION_KEY);

  const url = `${BASE_URL}/${path}${buildQuery(params)}`;

  const response = await fetch(url, {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await response.json().catch(() => ({}));

  if (!response.ok || json.status === false) {
    const error = new Error(json.message || 'Something went wrong. Please try again.');
    error.payload = json;
    throw error;
  }

  return json;
}

// ── Catalog ─────────────────────────────────────────────────────────
export const fetchNetworks = (userId) =>
  request('fetch_networks', { params: { user_id: userId } });

export const fetchProducts = (userId) =>
  request('fetch_products', { params: { user_id: userId } });

// productSlug: 'data' | 'airtime' | 'utility_bills' | 'cable_subscription'
// networkId only applies to airtime/data.
export const fetchProductPlanCategories = ({ userId, productSlug, networkId }) =>
  request('fetch_product_plan_categories', {
    params: { user_id: userId, product_slug: productSlug, network_id: networkId },
  });

// Which params matter depends on productSlug:
//  - data: networkId + planCategoryId (+ optional amount)
//  - airtime: networkId only
//  - utility_bills: amount only
//  - cable_subscription: none beyond the slug
export const fetchProductPlans = ({ userId, productSlug, networkId, planCategoryId, amount }) =>
  request('fetch_product_plans', {
    params: {
      user_id: userId,
      product_slug: productSlug,
      network_id: networkId,
      plan_category_id: planCategoryId,
      amount,
    },
  });

// ── Purchases ───────────────────────────────────────────────────────
export const buyAirtime = (payload) => request('buy_airtime', { method: 'POST', body: payload });
export const buyData = (payload) => request('buy_data', { method: 'POST', body: payload });
export const buyCableTv = (payload) => request('buy_cable_tv', { method: 'POST', body: payload });
export const buyElectricity = (payload) => request('buy_electricity', { method: 'POST', body: payload });

export const validateCableTv = (payload) => request('validate_cable_tv', { method: 'POST', body: payload });
export const validateMetreNumber = (payload) => request('validate_metre_number', { method: 'POST', body: payload });

// ── Transactions ────────────────────────────────────────────────────
export const fetchTransactions = ({ userId, dateFrom, dateTo }) =>
  request('fetch_transactions', { params: { user_id: userId, date_from: dateFrom, date_to: dateTo } });

export const fetchSingleTransaction = ({ userId, transactionId }) =>
  request('fetch_single_transaction', { params: { user_id: userId, transaction_id: transactionId } });
