import * as SecureStore from 'expo-secure-store';
import { alertForPurchaseError } from './format';

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

// Tracks which step of signup an account has actually reached, independent
// of USER_KEY/SESSION_KEY — those two get written to SecureStore the moment
// Register succeeds, before email verification, phone verification, or PIN
// setup happen. Without this, killing the app mid-signup (Samuel's "phone
// dies during registration" case) left bootstrap() seeing a session + user
// record and routing straight to Home, skipping every remaining step — a
// real bypass, not just a UX gap. App.js's bootstrap() checks this before
// trusting a saved session; each signup screen advances it on success, and
// it's cleared the moment PIN setup actually completes.
const SIGNUP_STEP_KEY = 'megasub_signup_step';

export function setSignupStep(step) {
  return SecureStore.setItemAsync(SIGNUP_STEP_KEY, step);
}

export function getSignupStep() {
  return SecureStore.getItemAsync(SIGNUP_STEP_KEY);
}

export function clearSignupStep() {
  return SecureStore.deleteItemAsync(SIGNUP_STEP_KEY).catch(() => {});
}

// Per-account record of whether phone verification and PIN setup are done,
// keyed by user id — separate from USER_KEY, which is a single slot holding
// only whichever account is CURRENTLY signed in. Without this, signing out
// of account A and into account B checked "is setup complete" against A's
// leftover cached record (USER_KEY still held A's data at that point), which
// never matched B's id/email/username/phone — so a fully set-up account B
// got routed through phone verification again on every account switch on
// the same device. User id is the one identifier that's always present and
// never changes, unlike email/username/phone which login.jsx also accepts
// as the typed identifier.
const ACCOUNT_SETUP_KEY = 'megasub_account_setup_by_id';

export async function getAccountSetupStatus(userId) {
  if (!userId) return null;
  try {
    const raw = await SecureStore.getItemAsync(ACCOUNT_SETUP_KEY);
    const map = raw ? JSON.parse(raw) : {};
    return map[userId] || null;
  } catch {
    return null;
  }
}

// Merges rather than overwrites — a phone-verification write must not erase
// a pin_set flag saved moments earlier by a different step, and vice versa.
export async function saveAccountSetupStatus(userId, { phone_number, pin_set } = {}) {
  if (!userId) return;
  try {
    const raw = await SecureStore.getItemAsync(ACCOUNT_SETUP_KEY);
    const map = raw ? JSON.parse(raw) : {};
    const existing = map[userId] || {};
    map[userId] = {
      phone_number: phone_number ?? existing.phone_number ?? '',
      pin_set: pin_set ?? existing.pin_set ?? false,
    };
    await SecureStore.setItemAsync(ACCOUNT_SETUP_KEY, JSON.stringify(map));
  } catch {
    // Best-effort — worst case this account re-verifies on its next switch,
    // same behavior as before this fix existed.
  }
}

// Error logs print the request body for debugging — PINs, passwords and
// identity numbers (BVN/NIN) must never land in device logs, so those keys
// are masked first. FormData bodies (KYC uploads) pass through untouched.
const REDACTED_KEYS = new Set(['pin', 'password', 'bvn', 'nin']);
function redactBody(body) {
  if (!body || typeof body !== 'object' || typeof body.append === 'function') return body;
  return Object.fromEntries(
    Object.entries(body).map(([key, value]) => [key, REDACTED_KEYS.has(key) ? '***' : value])
  );
}

// This API always responds with HTTP 200 and signals success/failure through
// the JSON `status` field, so response.ok alone can't be trusted.
async function request(path, { method = 'GET', body, params } = {}) {
  const token = await SecureStore.getItemAsync(SESSION_KEY);

  const url = `${BASE_URL}/${path}${buildQuery(params)}`;

  // A FormData body (KYC's selfie/document uploads) must NOT be
  // JSON-stringified or given an explicit Content-Type — fetch needs to set
  // its own multipart boundary, which a forced 'application/json' header
  // would break.
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

  let response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        Accept: 'application/json',
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
    });
  } catch (err) {
    // fetch() itself throwing (no route to the server, DNS failure, timeout)
    // is categorically different from the server responding with an error —
    // it means this device currently has no way to reach Megasub at all.
    // Flagged so callers (and the global network modal) can tell "you're
    // offline" apart from "the server rejected this," which the old raw
    // "Network request failed" message never let anyone distinguish.
    console.log(`❌ Network error on ${path}`, err?.message);
    const error = new Error("Could not connect to Megasub's servers. Check your connection and try again.");
    error.isNetworkError = true;
    error.cause = err;
    throw error;
  }

  const json = await response.json().catch(() => ({}));

  if (!response.ok || json.status === false) {
    console.log(`❌ API error on ${path}`, JSON.stringify({ httpStatus: response.status, sent: redactBody(body), received: json }));

    if (response.status === 401) {
      if (!unauthorizedHandled) {
        unauthorizedHandled = true;
        onUnauthorized?.();
      }
      const error = new Error('Your session has expired. Please log in again.');
      error.payload = json;
      error.isUnauthorized = true;
      throw error;
    }

    // A route the server doesn't have (V2 endpoints that aren't deployed to
    // production yet) answers 404 "The route ... could not be found." Flagged
    // so callers can degrade gracefully: screens show a "coming soon" notice
    // (isUnavailable) and buyBulkData falls back to looping buy_data
    // (isRouteMissing) instead of surfacing a generic failure.
    if (response.status === 404 && /route .* could not be found/i.test(json?.message || '')) {
      const error = new Error('This feature is not available yet. Please check back soon.');
      error.payload = json;
      error.isRouteMissing = true;
      error.isUnavailable = true;
      throw error;
    }

    // Provider-backed V2 products (cards, eSIM, result checker) that aren't
    // live yet answer HTTP 503 with data.available === false and demo values
    // (is_demo: true). That is a deliberate "not available yet" signal, not a
    // server fault, and the demo values must never be shown as a customer's
    // real assets — so it gets its own flag, checked before the generic 5xx
    // branch below, and the backend's own message is kept.
    if (json?.data?.available === false || json?.data?.is_demo === true) {
      const error = new Error(json.message || 'This product is temporarily unavailable.');
      error.payload = json;
      error.isUnavailable = true;
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

// ── Result Checker (WAEC / NECO) — V2 ──────────────────────────────
// Catalog of exam boards on offer + unit price per PIN, mirroring
// fetch_networks' shape so ResultChecker.js's loading/error/empty states
// follow the same pattern every other catalog screen already uses.
export const fetchResultCheckerProducts = (userId) =>
  request('fetch_result_checker_products', { params: { user_id: userId } });

// quantity > 1 buys a batch in one call; response carries one PIN per unit
// (see ResultChecker.js's success screen) so a partial failure can still
// show whichever PINs did get issued.
export const buyResultChecker = (payload) => request('buy_result_checker', { method: 'POST', body: payload });

// Unused scratch-card stock metadata (serial + amount only — PINs stay
// hidden server-side until actually purchased). examType defaults to 'all'.
export const fetchResultCheckerUnusedCards = (userId, examType = 'all') =>
  request('fetch_result_checker_unused_cards', { params: { user_id: userId, exam_type: examType } });

export const fetchResultCheckerTransactions = (userId, examType = 'all') =>
  request('fetch_result_checker_transactions', { params: { user_id: userId, exam_type: examType } });

// ── Global eSIM — V2 ────────────────────────────────────────────────
export const fetchEsimCountries = (userId, search) =>
  request('fetch_esim_countries', { params: { user_id: userId, search } });

export const fetchEsimPlans = ({ userId, countryCode }) =>
  request('fetch_esim_plans', { params: { user_id: userId, country_code: countryCode } });

export const buyEsim = (payload) => request('buy_esim', { method: 'POST', body: payload });

export const fetchMyEsims = (userId) =>
  request('fetch_my_esims', { params: { user_id: userId } });

// ── Virtual Card — V2 ───────────────────────────────────────────────
// Products list which card types exist and whether each is enabled (Dollar
// is on, Naira is listed but disabled).
export const fetchVirtualCardProducts = (userId) =>
  request('fetch_virtual_card_products', { params: { user_id: userId } });

// Card creation is KYC-gated: status is one of unavailable/pending/
// verified (and whatever the provider adds), submit_card_kyc takes the BVN
// plus identity and address details.
export const fetchCardKycStatus = (userId) =>
  request('fetch_card_kyc_status', { params: { user_id: userId } });

export const submitCardKyc = (payload) => request('submit_card_kyc', { method: 'POST', body: payload });

// data is { cards: [...] }, not a bare array.
export const fetchCards = (userId) => request('fetch_cards', { params: { user_id: userId } });

export const createCard = (payload) => request('create_card', { method: 'POST', body: payload });

export const fetchCardDetails = ({ userId, cardId }) =>
  request('fetch_card_details', { params: { user_id: userId, card_id: cardId } });

export const freezeCard = (payload) => request('freeze_card', { method: 'POST', body: payload });
export const unfreezeCard = (payload) => request('unfreeze_card', { method: 'POST', body: payload });
export const fundCard = (payload) => request('fund_card', { method: 'POST', body: payload });

// ── Bulk Data — V2 ──────────────────────────────────────────────────
// One plan/network applies to every recipient (same convention as the
// existing Bulk Recharge/airtime batch); `recipients` is a plain array of
// phone numbers. Response carries a per-recipient status so a partial
// failure can be retried without re-charging the ones that already went
// through.
// The server-side batch routes (buy_bulk_data / retry_bulk_data_batch) are
// preferred, but they are not deployed to production yet. Until they are,
// this falls back to the documented single-recipient buy_data, called once
// per recipient, sequentially, so Bulk Data works today and switches to the
// server batch on its own once that ships. Both paths return the same shape:
// { data: { batch_id, total_amount, successful_count, failed_count,
// results: [{ phone_number, status, failure_reason, transaction_id }] } }.
const LOCAL_BATCH_PREFIX = 'local-';
export const isLocalBulkBatch = (batchId) => String(batchId || '').startsWith(LOCAL_BATCH_PREFIX);

// Errors that mean every remaining recipient would fail the same way (wrong
// PIN, no connection, expired session, low balance, unverified-phone limit),
// as opposed to a problem with one particular number.
function stopsBatch(error) {
  const info = alertForPurchaseError(error);
  return (
    !!error.isNetworkError ||
    !!error.isUnauthorized ||
    info.isWrongPin ||
    info.requiresPhoneVerification ||
    /insufficient|low balance|not enough/i.test(error.message || '')
  );
}

async function runBulkDataLocally(base, recipients, { unitPrice = 0, batchId, onProgress } = {}) {
  const results = [];
  let stopReason = null;

  for (let i = 0; i < recipients.length; i += 1) {
    const phone = recipients[i];

    if (stopReason) {
      results.push({ phone_number: phone, status: 'failed', failure_reason: stopReason, transaction_id: null });
      continue;
    }

    onProgress && onProgress(i, recipients.length);
    try {
      const json = await request('buy_data', {
        method: 'POST',
        body: { ...base, phone_number: phone, wallet_category: 'main_wallet', validatephonenetwork: 1 },
      });
      results.push({
        phone_number: phone,
        status: 'successful',
        failure_reason: null,
        transaction_id: json?.data?.id ?? json?.data?.transaction_id ?? null,
      });
    } catch (error) {
      // Nothing has been spent yet, so hand a batch-wide problem straight to
      // the screen (wrong-PIN modal, connection modal, ...) instead of
      // showing a list of identical failures.
      if (i === 0 && stopsBatch(error)) throw error;

      if (stopsBatch(error)) {
        // A dropped connection is ambiguous: the purchase may have gone
        // through. Say so, and never retry it automatically.
        const reason = error.isNetworkError
          ? 'No response received. Check Transaction History before retrying, this purchase may have gone through.'
          : error.message;
        results.push({ phone_number: phone, status: 'failed', failure_reason: reason, transaction_id: null });
        stopReason = error.isNetworkError ? 'Not attempted, connection was lost.' : `Not attempted: ${error.message}`;
      } else {
        results.push({
          phone_number: phone,
          status: 'failed',
          failure_reason: error.message || 'Purchase failed.',
          transaction_id: null,
        });
      }
    }
  }

  const successful = results.filter((r) => r.status === 'successful').length;
  return {
    status: true,
    code: 200,
    message: 'Bulk data batch processed.',
    data: {
      batch_id: batchId || `${LOCAL_BATCH_PREFIX}${Date.now()}`,
      total_amount: (Number(unitPrice) * successful).toFixed(4),
      successful_count: successful,
      failed_count: results.length - successful,
      results,
    },
  };
}

// options (used by the fallback only): { unitPrice, onProgress(index, total) }
export async function buyBulkData(payload, options = {}) {
  try {
    return await request('buy_bulk_data', { method: 'POST', body: payload });
  } catch (error) {
    if (!error.isRouteMissing) throw error;
  }
  const { recipients, ...base } = payload;
  return runBulkDataLocally(base, recipients, options);
}

// For a batch made by the fallback there is nothing server-side to retry, so
// `local` carries what is needed to re-run just the failed recipients:
// { base: <buy_data fields>, recipients: [failed numbers], unitPrice, onProgress }.
export async function retryBulkDataBatch(payload, local) {
  if (local && isLocalBulkBatch(payload.batch_id)) {
    const { base, recipients, ...options } = local;
    return runBulkDataLocally({ ...base, user_id: payload.user_id, pin: payload.pin }, recipients, {
      ...options,
      batchId: payload.batch_id,
    });
  }
  return request('retry_bulk_data_batch', { method: 'POST', body: payload });
}

// ── Standalone KYC (SecureWave BVN) — V2 ────────────────────────────
// Both calls identify the user by their login token alone — the backend takes
// no user_id here. fetch_kyc_status returns the state plus the KYC rules
// (fee, free first verification, max attempts, minimum profile-match score).
export const fetchKycStatus = () => request('fetch_kyc_status');

// Only calls SecureWave when the user isn't already verified; once verified
// the backend answers from its saved result instead of re-charging. May carry
// a verification fee (see settings.verification_fee in fetch_kyc_status).
export const verifyBvn = ({ phone, bvn }) => request('verify_bvn', { method: 'POST', body: { phone, bvn } });

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
