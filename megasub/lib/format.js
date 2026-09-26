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

// Dollar amounts (eSIM plans, Dollar Virtual Card) come back as strings like
// "4.50" alongside a currency code. Always two decimals, since cents matter
// here unlike whole-naira purchases. Any non-USD code is printed as a prefix
// instead of a symbol so an unexpected currency is never mislabelled "$".
export function formatUsd(value, currency = 'USD') {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value ?? '');
  const formatted = n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return !currency || String(currency).toUpperCase() === 'USD' ? `$${formatted}` : `${currency} ${formatted}`;
}

// Dollar-card funding charge, from the product's funding_markup_* rules
// (fetch_virtual_card_products). A flat markup is a fixed USD amount; a
// percentage markup scales with the amount. Returns null for a rule type this
// app doesn't understand, so the UI says "a funding charge applies" instead
// of showing a made-up number for real money.
export function cardFundingCharge(product, amount) {
  if (!product) return 0;
  const value = Number(product.funding_markup_value);
  if (!Number.isFinite(value)) return 0;
  const type = String(product.funding_markup_type || 'flat').toLowerCase();
  if (type === 'flat') return value;
  if (type === 'percent' || type === 'percentage') {
    return Math.round(((Number(amount) || 0) * value) / 100 * 100) / 100;
  }
  return null;
}

// Amount plus charge, rounded to cents (0.1 + 0.2 must not print $0.30000000000000004).
export function cardTotalUsd(amount, charge) {
  if (charge === null || charge === undefined) return null;
  return Math.round((Number(amount) + Number(charge)) * 100) / 100;
}

// An eSIM activation string looks like "LPA:1$smdp.example.com$MATCHING-ID".
// A phone can't scan a QR code shown on its own screen, so installing on the
// same device means typing the two parts in by hand (iOS: Settings > Mobile
// Service > Add eSIM > Enter Details Manually). Returns null for anything
// that isn't that shape so the caller just shows the raw string.
export function parseLpaCode(lpa) {
  const parts = String(lpa || '').trim().split('$');
  if (parts.length < 3 || !/^LPA:/i.test(parts[0])) return null;
  const smdp = parts[1].trim();
  const code = parts.slice(2).join('$').trim();
  return smdp && code ? { smdp, code } : null;
}

// +2348059674789, 2348059674789 and 8059674789 all become 08059674789 — the
// 11-digit local form the API and the BVN check expect.
export function toLocalNigerianPhone(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('234') && digits.length === 13) digits = `0${digits.slice(3)}`;
  else if (digits.length === 10) digits = `0${digits}`;
  return digits;
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

// Data plan names (SME especially) come back with the validity baked into
// the string itself — e.g. "1000MB SME - 1 MONTH VALIDITY" or "1GB - 1 WEEK
// VALIDITY" — which is redundant with the "X days" meta line PlanGrid
// already shows above the title, and reads as one long oversized line
// wrapping awkwardly inside a small plan card. Strips a trailing "<number>
// DAY(S)/WEEK(S)/MONTH(S) [VALID/VALIDITY]" phrase (plus any leftover
// separator) so the card just reads the plan size, e.g. "1000MB SME".
export function formatPlanTitle(name) {
  const raw = String(name || '').trim();
  const stripped = raw
    .replace(/[\s-]*\d+\s*(day|days|week|weeks|month|months)\s*(valid(?:ity)?)?\s*$/i, '')
    .trim();
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

// Pulls a person's BVN details out of a KYC response. The verify_bvn reply
// nests them under provider.data.personal_info, and the status endpoint may
// carry them directly, so a few likely spots are checked. Returns null when
// no name, contact or photo is present. `image` is a ready-to-render uri (a
// raw base64 string gets a data: prefix); provider flags such as
// image_present (true, but no picture attached) are not treated as a photo.
export function extractBvnProfile(...sources) {
  for (const source of sources) {
    if (!source || typeof source !== 'object') continue;
    const info =
      source.personal_info ||
      source.provider?.data?.personal_info ||
      source.data?.personal_info ||
      source.profile ||
      source;

    const first = info.first_name || info.firstName || '';
    const middle = info.middle_name || info.middleName || '';
    const last = info.last_name || info.lastName || '';
    const fullName = String(info.full_name || info.fullName || [first, middle, last].filter(Boolean).join(' ')).trim();

    let image = info.image || info.photo || info.picture || info.image_base64 || info.image_url || null;
    if (typeof image !== 'string') image = null;
    else if (!/^(data:|https?:)/i.test(image)) image = image.length >= 20 ? `data:image/jpeg;base64,${image}` : null;

    const phone = info.phone_number || info.phone || '';
    const email = info.email || '';
    const dob = info.date_of_birth || info.dob || '';

    if (fullName || image || phone || email) {
      return { fullName, phone: String(phone || ''), email: String(email || ''), dob: String(dob || ''), image };
    }
  }
  return null;
}
