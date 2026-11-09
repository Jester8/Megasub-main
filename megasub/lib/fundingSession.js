// Wallet-funding credits can only be read with the transaction PIN
// (fetch_user_naira_funding_transactions), so they aren't in the normal
// transaction list. Once the user unlocks them on one screen (Notifications
// or Wallet), they're kept for the rest of the app session so the other
// screen shows them too without asking for the PIN again. Memory only:
// never written to disk, gone when the app closes or the user logs out.
let cached = null;

export function getSessionFunding() {
  return cached;
}

export function setSessionFunding(list) {
  cached = Array.isArray(list) ? list : null;
}

export function clearSessionFunding() {
  cached = null;
}

export function isFundingSuccessful(funding) {
  return funding.status === 'SUCCESSFUL' || funding.funding_status === 'success';
}
