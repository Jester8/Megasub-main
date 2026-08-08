// Strips everything but digits from a typed amount — the number-pad
// keyboard doesn't stop a pasted "-500" or "1.5" from landing in the field,
// and the API has no server-side floor, so a negative amount would otherwise
// reach buy_airtime/buy_data/buy_electricity unchecked. Amounts are always
// whole naira, so this also rules out decimals rather than just the sign.
export function sanitizePositiveInt(text) {
  return String(text ?? '').replace(/[^0-9]/g, '');
}

// Adds thousands separators to a naira amount — figures ≥1,000 were
// rendering as raw digits across the buy screens (e.g. "₦20000" instead of
// "₦20,000"), flagged in QA (Screenshot #10).
export function formatNaira(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value ?? '');
  return n.toLocaleString('en-NG', { maximumFractionDigits: 2 });
}

// Category names come back from the API prefixed with the network they
// belong to (e.g. "MTN GIFTING", "MTN SME") — redundant once the network is
// already shown selected above the tab row (QA Screenshot #11: "repeating
// the same thing"). Strips a leading "<network> " (any case, optional dash)
// so the tab just reads "Gifting" / "SME". Falls back to the original label
// if stripping would leave nothing (e.g. the category name IS the network).
export function stripNetworkPrefix(label, networkName) {
  const raw = String(label || '');
  const network = String(networkName || '').trim();
  if (!network) return raw;

  const pattern = new RegExp(`^${network.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*-?\\s*`, 'i');
  const stripped = raw.replace(pattern, '').trim();
  return stripped || raw;
}

// The backend's own message for a rejected PIN varies ("Incorrect PIN" on
// buy_cable_tv, "PIN mismatch" elsewhere) and was surfacing raw under a
// generic "Transaction Failed" title across every buy screen. QA (Screenshot
// #21) asked for this to read "Wrong Pin" specifically, so failed purchases
// now detect every wrong-PIN wording and override the message instead of
// passing the raw backend text through. `isWrongPin` lets callers show the
// dedicated WrongPinModal instead of a generic Alert for this case.
//
// Unverified phones also have a cumulative ₦30,000 daily limit — exceeding
// it rejects the purchase with data.requires_phone_verification: true
// instead of a plain failure, and `requiresPhoneVerification` lets callers
// route to the phone-verification step instead of just showing an error.
export function alertForPurchaseError(error) {
  const message = error?.message || '';
  const isWrongPin = /incorrect pin|invalid pin|pin mismatch|pins? (do(es)?n'?t|does not) match/i.test(message);
  const requiresPhoneVerification = !!error?.payload?.data?.requires_phone_verification;

  if (requiresPhoneVerification) {
    return {
      title: 'Phone Verification Required',
      message:
        message ||
        "You've reached the ₦30,000 daily limit for an unverified phone number. Verify your number to continue.",
      isWrongPin: false,
      requiresPhoneVerification: true,
    };
  }

  return isWrongPin
    ? { title: 'Wrong Pin', message: 'The PIN you entered was not accepted. Please try again.', isWrongPin: true, requiresPhoneVerification: false }
    : { title: 'Transaction Failed', message: message || 'Please check your information and PIN.', isWrongPin: false, requiresPhoneVerification: false };
}
