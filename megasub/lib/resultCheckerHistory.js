import AsyncStorage from '@react-native-async-storage/async-storage';

// Neither fetch_transactions nor fetch_result_checker_transactions returns
// the issued scratch-card PINs — only buy_result_checker's response does. So
// the PINs are saved on the device the moment a purchase succeeds, and every
// receipt (History, Recent, Wallet, Notifications) looks them up here.

const MAX_SAVED_RECORDS = 500;
// The saved record's time comes from the buy response (or the device clock
// when the response has none), so it is matched to the server transaction
// by exam board plus a small time window rather than an exact timestamp.
const MATCH_WINDOW_MS = 5 * 60 * 1000;

function storageKey(userId) {
  return `megasub-result-checker-history:${userId}`;
}

function recordKeys(record) {
  return [record?.id, record?.transaction_id, record?.txn_reference, record?.transaction_reference, record?.reference]
    .filter((value) => value !== undefined && value !== null && value !== '')
    .map(String);
}

export async function loadSavedResultCheckerHistory(userId) {
  if (!userId) return [];
  try {
    const serialized = await AsyncStorage.getItem(storageKey(userId));
    const records = serialized ? JSON.parse(serialized) : [];
    return Array.isArray(records) ? records : [];
  } catch {
    return [];
  }
}

export async function saveResultCheckerHistoryRecord(userId, record) {
  if (!userId || !record) return [];
  const current = await loadSavedResultCheckerHistory(userId);
  const keys = recordKeys(record);
  const next = [record, ...current.filter((existing) => !recordKeys(existing).some((key) => keys.includes(key)))]
    .slice(0, MAX_SAVED_RECORDS);
  await AsyncStorage.setItem(storageKey(userId), JSON.stringify(next));
  return next;
}

const PIN_VALUE_KEYS = ['pin', 'pin_code', 'pin_number', 'exam_pin', 'voucher_pin', 'card_pin', 'scratch_card_pin', 'token'];
const PIN_SERIAL_KEYS = ['serial', 'serial_number', 'serial_no', 'card_serial', 'voucher_serial'];
const PIN_COLLECTION_KEYS = new Set([
  'pins', 'resultcheckers', 'resultcheckerpins', 'exampins', 'scratchcards', 'vouchers', 'cards',
]);
const PIN_WRAPPER_KEYS = new Set(['data', 'details', 'result', 'resultcheckerdetails', 'purchase', 'payload', 'transaction']);

function firstPresent(source, keys) {
  for (const key of keys) {
    const value = source[key];
    if (value !== null && value !== undefined && String(value).trim() !== '') return String(value).trim();
  }
  return undefined;
}

function collectPins(value, entries, seen, inPinCollection) {
  if (Array.isArray(value)) {
    value.forEach((entry) => collectPins(entry, entries, seen, inPinCollection));
    return;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    if (inPinCollection && String(value).trim()) entries.push({ pin: String(value).trim() });
    return;
  }
  if (!value || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);

  // A bare `pin` on the outer response could be the user's transaction PIN
  // echoed back, so outside a PIN collection it only counts as a card when
  // it comes with a serial.
  const pin = firstPresent(value, PIN_VALUE_KEYS);
  const serial = firstPresent(value, PIN_SERIAL_KEYS);
  if (inPinCollection ? (pin || serial) : (pin && serial)) {
    entries.push({ ...(pin ? { pin } : {}), ...(serial ? { serial } : {}) });
  }

  Object.entries(value).forEach(([key, child]) => {
    const normalizedKey = key.replace(/[^a-z0-9]/gi, '').toLowerCase();
    const isPinCollection = PIN_COLLECTION_KEYS.has(normalizedKey);
    if (isPinCollection || PIN_WRAPPER_KEYS.has(normalizedKey)) {
      collectPins(child, entries, seen, inPinCollection || isPinCollection);
    }
  });
}

// Pulls every { pin, serial } out of a buy_result_checker response (or a
// saved record), whatever wrapper the backend nests them under, de-duplicated.
export function extractResultCheckerPins(value) {
  const entries = [];
  collectPins(value, entries, new Set(), false);
  const seen = new Set();
  return entries.filter((entry) => {
    const key = `${entry.pin || ''}:${entry.serial || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// fetch_transactions has no exam_type field — product_plan_id
// ("waec_result_checker") and the description carry it.
export function resultCheckerExamType(record) {
  const explicit = record?.exam_type || record?.examType;
  const text = [explicit, record?.product_plan_id, record?.description, record?.product_plan_name].filter(Boolean).join(' ');
  const match = text.match(/(waec|neco|nabteb|jamb)/i);
  if (match) return match[1].toUpperCase();
  return explicit ? String(explicit).toUpperCase() : undefined;
}

// The record from `records` describing the same purchase as `transaction`:
// a shared id/reference when there is one, otherwise the same exam board
// bought at (nearly) the same moment — the closest one wins.
export function findMatchingResultCheckerRecord(records, transaction, windowMs = MATCH_WINDOW_MS) {
  if (!Array.isArray(records) || records.length === 0 || !transaction) return null;
  const keys = recordKeys(transaction);
  const byKey = records.find((record) => recordKeys(record).some((key) => keys.includes(key)));
  if (byKey) return byKey;

  const exam = resultCheckerExamType(transaction);
  const time = new Date(transaction.created_at).getTime();
  if (!exam || Number.isNaN(time)) return null;

  let best = null;
  let bestDelta = Infinity;
  records.forEach((record) => {
    if (resultCheckerExamType(record) !== exam) return;
    const delta = Math.abs(new Date(record.created_at).getTime() - time);
    if (delta <= windowMs && delta < bestDelta) {
      best = record;
      bestDelta = delta;
    }
  });
  return best;
}
