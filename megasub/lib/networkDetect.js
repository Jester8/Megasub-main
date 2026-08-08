// Standard Nigerian MSISDN prefix table, used to auto-select the recharge
// network from a typed/picked number instead of leaving whatever network was
// last selected (e.g. an MTN number recharged while Glo stayed selected).
const PREFIX_NETWORK = {
  // MTN
  '0803': 'MTN', '0806': 'MTN', '0703': 'MTN', '0706': 'MTN', '0813': 'MTN',
  '0816': 'MTN', '0810': 'MTN', '0814': 'MTN', '0903': 'MTN', '0906': 'MTN',
  '0913': 'MTN', '0916': 'MTN',
  // Airtel
  '0802': 'AIRTEL', '0808': 'AIRTEL', '0708': 'AIRTEL', '0812': 'AIRTEL',
  '0701': 'AIRTEL', '0902': 'AIRTEL', '0907': 'AIRTEL', '0901': 'AIRTEL',
  '0904': 'AIRTEL', '0912': 'AIRTEL',
  // Glo
  '0805': 'GLO', '0807': 'GLO', '0705': 'GLO', '0815': 'GLO', '0811': 'GLO',
  '0905': 'GLO', '0915': 'GLO',
  // 9mobile
  '0809': '9MOBILE', '0817': '9MOBILE', '0818': '9MOBILE', '0908': '9MOBILE',
  '0909': '9MOBILE',
};

// Returns 'MTN' | 'AIRTEL' | 'GLO' | '9MOBILE' | null for an 11-digit
// leading-zero Nigerian number; null for anything shorter/unrecognized —
// callers should leave the current selection alone in that case.
export function detectNetworkFromPhone(phone) {
  const cleaned = String(phone || '').replace(/\s+/g, '');
  if (cleaned.length < 4) return null;
  return PREFIX_NETWORK[cleaned.slice(0, 4)] || null;
}

// Matches a detected label (e.g. 'MTN') against the API's own networks list
// by network_name, case-insensitively — the API is the source of truth for
// which network objects/ids actually exist.
export function findNetworkByLabel(networks, label) {
  if (!label) return null;
  return (networks || []).find(
    (n) => String(n.network_name || '').toUpperCase() === label
  ) || null;
}
