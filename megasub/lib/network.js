import NetInfo from '@react-native-community/netinfo';

// Real connectivity state, not a guess — `isConnected` alone lies on some
// networks (e.g. a WiFi router with no working internet upstream still
// reports "connected"), so `isInternetReachable` is what actually matters
// for "can this device reach Megasub's servers right now."
let currentlyOnline = true;

NetInfo.addEventListener((state) => {
  currentlyOnline = state.isInternetReachable !== false;
});

// One-shot check when a fresh answer is worth the small delay (e.g. right
// before submitting a payment) rather than trusting the last event, which
// could be a few seconds stale.
export async function isOnline() {
  try {
    const state = await NetInfo.fetch();
    currentlyOnline = state.isInternetReachable !== false;
    return currentlyOnline;
  } catch {
    // NetInfo itself failing to answer isn't proof of an outage — fall back
    // to whatever the last real event said instead of blocking the user.
    return currentlyOnline;
  }
}

// Synchronous, best-effort read for UI that can't await (e.g. a render-time
// banner) — prefer isOnline() wherever an await is affordable.
export function isOnlineSync() {
  return currentlyOnline;
}

// Same shape as setUnauthorizedHandler in lib/api.js — App.js registers the
// actual modal-showing function here once, so any screen anywhere can
// trigger the app-wide network error modal without importing React state
// from App.js.
let onNetworkError = null;
export function setNetworkErrorHandler(fn) {
  onNetworkError = fn;
}

// Call this immediately before any action that requires a live network call
// to succeed for the user's money/data to be safe — a purchase, a PIN
// change, anything where "silently do nothing" or "fail with a cryptic
// error" would be worse than telling them up front. Returns true if it's
// safe to proceed, false (and shows the app-wide modal) if not.
export async function requireNetworkOrShowError() {
  const online = await isOnline();
  if (!online) {
    onNetworkError?.();
  }
  return online;
}
