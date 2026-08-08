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

// Mega-Sub has no refresh-token endpoint, so an expired session can't be
// silently renewed — App.js registers a handler here (clear storage, route
// to login) so every screen reacts the same way instead of each one
// showing its own confusing "Unauthenticated"/generic error.
let onUnauthorized = null;
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

// A screen that fires several requests at once (e.g. Cable's Promise.all)
// gets a 401 back on all of them within the same tick — each one used to
// call onUnauthorized() and stack a separate "Session Expired" alert, which
// read as being logged out repeatedly for a single expiry. Only the first
// 401 in a burst is allowed through; resetUnauthorizedGuard() re-arms it
// once a fresh session exists again (called right after login).
let unauthorizedHandled = false;
export function resetUnauthorizedGuard() {
  unauthorizedHandled = false;
}

// fetch_naira_virtual_accounts needs the PIN on every call (that's what
// makes it the one reliable PIN-verification proxy — see TopUp.js), so
// there's no way to re-fetch without asking again. Caching the *result*
// instead means TopUp only has to unlock once per app session: once the
// account list is known, later visits show it straight away instead of
// re-prompting for the PIN just to look at details already seen. Cleared on
// logout/session-expiry so the next person on a shared device isn't handed
// the previous user's account details.
let cachedVirtualAccounts = null;
export function getCachedVirtualAccounts() {
  return cachedVirtualAccounts;
}
export function setCachedVirtualAccounts(list) {
  cachedVirtualAccounts = list;
}
export function clearCachedVirtualAccounts() {
  cachedVirtualAccounts = null;
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
    console.log(`❌ API error on ${path}`, JSON.stringify({ httpStatus: response.status, sent: body, received: json }));

    if (response.status === 401) {
      if (!unauthorizedHandled) {
        unauthorizedHandled = true;
        onUnauthorized?.();
      }
      const error = new Error('Your session has expired. Please log in again.');
      error.payload = json;
      throw error;
    }

    // 5xx is the backend failing, not anything the user did or sent — its raw
    // message ("Server Error") reads like the user's input was rejected.
    if (response.status >= 500) {
      const error = new Error(
        "Megasub's servers aren't responding right now. Please try again in a few minutes."
      );
      error.payload = json;
      error.isServerError = true;
      throw error;
    }

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

// Full account profile incl. live wallet balance (main_wallet). /login only
// returns { token, user: <id> }, so this is the only source of truth for
// the actual up-to-date balance shown on Home/Wallet.
export const fetchDashboard = (userId) =>
  request('dashboard', { method: 'POST', body: { user_id: userId } });

// ── Google Sign-In ──────────────────────────────────────────────────
// Deliberately NOT routed through request() — that helper treats every 401
// as an expired session and fires the app-wide onUnauthorized handler
// (clear storage, bounce to login). A 401 here just means the Google ID
// token was rejected before any Mega-Sub session existed, so it needs to
// surface as its own error instead. The backend auto-detects new vs
// returning accounts from this one call — tnc is only required to create a
// new account, but the docs say it's simply "not required" for an existing
// one, not that it must be omitted, so it's sent unconditionally.
export async function googleAuth({ idToken, deviceName, referralCode, tnc = true }) {
  const response = await fetch(`${BASE_URL}/google`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id_token: idToken,
      device_name: deviceName,
      ...(referralCode ? { referral_code: referralCode } : {}),
      tnc,
    }),
  });

  const json = await response.json().catch(() => ({}));

  if (!response.ok || json.status === false) {
    const error = new Error(googleAuthErrorMessage(json, response.status));
    error.payload = json;
    error.httpStatus = json.code || response.status;
    throw error;
  }

  return json;
}

// Maps the documented error codes (401/403/409/422/500/503) to copy a user
// can act on. The API's own `message` is fine for most cases (e.g. "Invalid
// or expired Google token."), but 403/409/503 read better with a more
// specific, actionable line than whatever the backend happens to send.
function googleAuthErrorMessage(json, httpStatus) {
  const code = json.code || httpStatus;
  switch (code) {
    case 403:
      return 'This account has been deactivated. Please contact support.';
    case 409:
      return 'This email is already linked to a different account. Please contact support.';
    case 422:
      return json.message || 'Google did not provide the information required to continue.';
    case 503:
      return 'Google sign-in is not available right now. Please try again later or use email instead.';
    default:
      return json.message || 'Could not sign in with Google. Please try again.';
  }
}

// ── Account Security ─────────────────────────────────────────────────
// Same call verify.jsx uses at signup to set the PIN the first time — there
// is no separate "change PIN" endpoint, so changing it is just calling this
// again with the new value. There's also no standalone "verify my PIN"
// endpoint, so ChangePin.js confirms the current PIN by calling
// fetch_naira_virtual_accounts with it first (that call IS PIN-gated) before
// overwriting it here.
export const setTransactionPin = ({ userId, pin }) =>
  request('set_transaction_pin', { method: 'POST', body: { user_id: userId, pin, confirm_pin: pin } });

// The documented, working password-reset path. change_password above was
// never real — ChangePassword.js sends the user here instead, since this is
// the only password-reset endpoint that exists on the backend.
export const forgotPassword = ({ email }) =>
  request('forgot_password', { method: 'POST', body: { email } });

// PIN recovery is a separate OTP flow from password reset (its own "Reset
// PIN" email) — forgot_pin sends the code, reset_pin confirms it and sets
// the new PIN in one call. ChangePin.js runs both steps in-app.
export const forgotPin = ({ email }) =>
  request('forgot_pin', { method: 'POST', body: { email } });

export const resetPin = ({ email, otp, pin }) =>
  request('reset_pin', { method: 'POST', body: { email, otp, pin, pin_confirmation: pin } });

// Permanently deletes the account server-side. Google-created accounts may
// have no password on file, so it's sent only when the caller has one.
export const deleteAccount = ({ userId, password }) =>
  request('delete_account', {
    method: 'DELETE',
    body: password ? { user_id: userId, password } : { user_id: userId },
  });

// user_id, fingerprint_status: 1 | 0 — keeps the biometric-lock preference
// known server-side alongside the local SecureStore flag Profile.js already
// keeps for actually gating the app.
export const updateFingerprintOption = ({ userId, enabled }) =>
  request('update_fingerprint_option', {
    method: 'PUT',
    body: { user_id: userId, fingerprint_status: enabled ? 1 : 0 },
  });

// ── Email Verification (required onboarding step) ──────────────────────
// register() auto-sends a 6-digit email OTP; this resends it (e.g. if the
// user didn't get the first one or navigated back to this step).
export const requestEmailVerification = ({ userId }) =>
  request('email_verification', { method: 'POST', body: { user_id: userId } });

export const confirmEmailVerification = ({ userId, otp }) =>
  request('confirm_email_verification', { method: 'POST', body: { user_id: userId, otp } });

// ── Phone Verification ──────────────────────────────────────────────
// Registers the phone number against the account server-side — without this
// the backend has no phone on file and refuses to create the user's funding
// account (surfaced as a misleading "Only Crystal pay…" error). Termii sends
// a real SMS code, so the user must enter the code they actually received —
// there is no accepted default anymore.
export const requestPhoneVerification = ({ userId, phoneNumber }) =>
  request('phone_verification', { method: 'POST', body: { user_id: userId, phone_number: phoneNumber } });

export const confirmPhoneVerification = ({ userId, otp }) =>
  request('confirm_phone_verification', { method: 'POST', body: { user_id: userId, otp } });

// confirm_phone_verification answers status:true even for a code it did not
// accept — the real result is data.verified (documented alongside pinId,
// msisdn and attemptsRemaining). Treating "no exception" as verified is how a
// wrong code slipped through and left the account unlinked, so an explicit
// false counts as a failure.
export async function confirmPhoneVerified({ userId, otp }) {
  const json = await confirmPhoneVerification({ userId, otp });
  console.log('🔐 confirm_phone_verification:', JSON.stringify(json));

  const verified = json?.data?.verified;
  // Absent means this deployment doesn't report the flag; only an explicit
  // false is treated as a rejection.
  return verified !== false;
}

// Links a phone number to the account. phone_verification is the call that
// actually sends the number — confirming it needs the real code Termii just
// texted, which isn't available here (this is the silent TopUp-linking path,
// not the signup screen where the user can type the code in). So this only
// sends the number and leaves confirmation unattempted.
export async function registerPhoneNumber({ userId, phoneNumber }) {
  const number = String(phoneNumber).trim();
  const sent = await requestPhoneVerification({ userId, phoneNumber: number });
  console.log('📤 phone_verification accepted:', JSON.stringify(sent));
  return { phoneNumber: number, confirmed: false };
}

// There is no way to read a user's phone number back from this API.
// /dashboard's data.user carries only main_wallet, first_name, last_name,
// email, username and main_wallet_formatted — no phone field of any kind
// (confirmed against the live backend). So the only evidence the number
// reached the backend is phone_verification returning status true; nothing
// in the app should try to verify it a second time.

// phone_verification sends a real SMS through Termii, so re-sending the same
// number costs credits and texts the user another code. Remember what has
// already been linked this session and skip the round trip.
const linkedThisSession = new Map();

export function markPhoneLinked(userId, phoneNumber) {
  const number = String(phoneNumber || '').trim();
  if (userId && number) linkedThisSession.set(userId, number);
}

// Sends the number to the backend and links it to the account. Throws only
// when there is no number to send, or when phone_verification itself fails —
// that is a real failure to deliver it.
export async function ensurePhoneOnFile({ userId, phoneNumber }) {
  const candidate = String(phoneNumber || '').trim();

  if (candidate && linkedThisSession.get(userId) === candidate) {
    console.log('📞 Phone already linked this session, not re-sending:', candidate);
    return { phoneNumber: candidate, verified: true };
  }

  if (!candidate) {
    const error = new Error('NO_PHONE_ON_FILE');
    error.needsPhoneNumber = true;
    throw error;
  }

  const result = await registerPhoneNumber({ userId, phoneNumber: candidate });
  markPhoneLinked(userId, candidate);

  return { phoneNumber: candidate, verified: result.confirmed };
}

// ── Naira Wallet Funding ────────────────────────────────────────────
export const fetchNairaFundingOptions = (userId) =>
  request('fetch_naira_funding_options', { params: { user_id: userId } });

// Requires the transaction PIN even to view — that's the API's design,
// not a client choice.
export const fetchNairaVirtualAccounts = ({ userId, pin }) =>
  request('fetch_naira_virtual_accounts', { params: { user_id: userId, pin } });

export const generateNairaVirtualAccount = (payload) =>
  request('generate_naira_virtual_accounts', { method: 'POST', body: payload });

// Wallet funding runs through Secure Wave (securewaveng), so it's the explicit
// first choice — the catalog keeps other providers (e.g. the retired Crystal
// Pay) alongside it, and is_current_option can lag behind the switch, so slug
// beats flag here.
export function pickFundingOption(options = []) {
  return (
    options.find((o) => o.slug === 'securewaveng') ||
    options.find((o) => String(o.is_current_option) === '1') ||
    options.find((o) => String(o.activation_status) === '1') ||
    options[0]
  );
}

// Secure Wave issues on exactly one bank — Kolomoni, bank code '1'. The code
// is fixed, so it is never derived from the provider's bank_codes list: that
// list is often empty (Crystal Pay returns []) and letting it decide would
// change what gets sent for no good reason. It is consulted for the display
// label only.
export const GENERATION_BANK_CODE = '1';

export function resolveGenerationBank(option) {
  const raw = Array.isArray(option?.bank_codes) ? option.bank_codes : [];
  const providerName = option?.funding_option_name || 'Funding';

  const match = raw.find((entry) => {
    const code = entry && typeof entry === 'object' ? entry.code ?? entry.bank_code : entry;
    return String(code) === GENERATION_BANK_CODE;
  });

  const label =
    match && typeof match === 'object'
      ? match.label ?? match.bank_name ?? match.name ?? providerName
      : providerName;

  return { code: GENERATION_BANK_CODE, label };
}

// ── Referral Code ───────────────────────────────────────────────────
// Setting a custom referral_code takes priority over the user's phone
// number as their shareable referral identifier.
export const updateReferralCode = ({ userId, referralCode }) =>
  request('update_referral_code', { method: 'PUT', body: { user_id: userId, referral_code: referralCode } });

// ── Coupons ─────────────────────────────────────────────────────────
export const fetchActiveCoupons = (userId) =>
  request('coupons/active', { params: { user_id: userId } });

export const checkCouponQualification = ({ userId, couponCode }) =>
  request('coupons/check-qualification', { method: 'POST', body: { user_id: userId, coupon_code: couponCode } });

// History of wallet-funding credits (bank transfers into the virtual
// account) — a separate list from fetch_transactions, and also requires
// the transaction PIN even to view.
export const fetchNairaFundingTransactions = ({ userId, pin }) =>
  request('fetch_user_naira_funding_transactions', { params: { user_id: userId, pin } });

// ── Transactions ────────────────────────────────────────────────────
export const fetchTransactions = ({ userId, dateFrom, dateTo }) =>
  request('fetch_transactions', { params: { user_id: userId, date_from: dateFrom, date_to: dateTo } });

export const fetchSingleTransaction = ({ userId, transactionId }) =>
  request('fetch_single_transaction', { params: { user_id: userId, transaction_id: transactionId } });
