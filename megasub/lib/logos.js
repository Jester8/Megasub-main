import { detectNetworkFromPhone } from './networkDetect';

// Same asset set already used independently in Airtime.js/Data.js/Bulk.js
// (network), Cable.js (cable provider) and Electricity.js (disco) — this
// copy is for transaction-history display, which has no purchase-flow state
// to key off, only the recorded transaction fields.
export const NETWORK_LOGOS = {
  MTN: require('../assets/networks/mtn.png'),
  AIRTEL: require('../assets/networks/airtel.png'),
  GLO: require('../assets/networks/glo.png'),
  '9MOBILE': require('../assets/networks/9mobile.png'),
};

const CABLE_LOGOS = [
  { match: 'DSTV', logo: require('../assets/networks/dstv.png') },
  { match: 'GOTV', logo: require('../assets/networks/gotv.png') },
  { match: 'STARTIMES', logo: require('../assets/networks/startimes.png') },
];

export function cableLogo(label) {
  const upper = String(label || '').toUpperCase();
  return CABLE_LOGOS.find((c) => upper.includes(c.match))?.logo || null;
}

const DISCO_LOGOS = [
  { match: 'IBADAN', logo: require('../assets/networks/ibedc.png') },
  { match: 'IBEDC', logo: require('../assets/networks/ibedc.png') },
  { match: 'ABUJA', logo: require('../assets/networks/abuja.png') },
  { match: 'PORT', logo: require('../assets/networks/portharcourt.png') },
  { match: 'PHED', logo: require('../assets/networks/portharcourt.png') },
  { match: 'KADUNA', logo: require('../assets/networks/kaduna.png') },
  { match: 'ENUGU', logo: require('../assets/networks/enugu.png') },
  { match: 'EEDC', logo: require('../assets/networks/enugu.png') },
  { match: 'EKO', logo: require('../assets/networks/eko.png') },
  { match: 'IKEJA', logo: require('../assets/networks/ikeja.png') },
  { match: 'KANO', logo: require('../assets/networks/kano.png') },
];

export function discoLogo(label) {
  const upper = String(label || '').toUpperCase();
  return DISCO_LOGOS.find((d) => upper.includes(d.match))?.logo || null;
}

// fetch_transactions has no dedicated provider field (confirmed in
// ReceiptModal.js) — airtime/data resolve the network from the recipient
// phone number the same way Airtime/Data's contact-picker fix does;
// cable/electricity fall back to matching product_plan_name's free text
// against the same provider keywords the buy screens use.
export function detectTransactionLogo(tx) {
  if (!tx) return null;
  const category = tx.transaction_category;

  if (category === 'airtime' || category === 'data') {
    const network = detectNetworkFromPhone(tx.phone_number);
    return network ? NETWORK_LOGOS[network] || null : null;
  }
  if (category === 'cable_subscription') {
    return cableLogo(tx.product_plan_name);
  }
  if (category === 'utility_bills') {
    return discoLogo(tx.product_plan_name);
  }
  return null;
}
