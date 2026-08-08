// Shared between the Home "Recent Transactions" widget and the full
// TransactionHistory screen so category styling/date formatting stay in sync.
export const CATEGORY_STYLE = {
  airtime: { icon: 'call-outline', color: '#7C3AED', bg: 'rgba(124,58,237,0.08)' },
  data: { icon: 'wifi-outline', color: '#00C9A7', bg: 'rgba(0,201,167,0.08)' },
  utility_bills: { icon: 'flash-outline', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
  cable_subscription: { icon: 'tv-outline', color: '#EC4899', bg: 'rgba(236,72,153,0.08)' },
};

export const DEFAULT_STYLE = { icon: 'briefcase-outline', color: '#4A55DD', bg: 'rgba(74,85,221,0.08)' };

export const STATUS_LABELS = { '1': 'Successful', '0': 'Pending', '-1': 'Failed' };

export const STATUS_COLOR = { '1': '#16A34A', '0': '#D97706', '-1': '#DC2626' };

// Card background by status, regardless of the service (airtime/data/cable/
// electricity) — status is what the user scans for at a glance, not category.
export const STATUS_BG = { '1': '#E6F7EC', '0': '#FFF6DE', '-1': '#FCE9E9' };

export const CATEGORY_OPTIONS = [
  { id: 'all', label: 'All Categories' },
  { id: 'airtime', label: 'Airtime' },
  { id: 'data', label: 'Data' },
  { id: 'cable_subscription', label: 'Cable TV' },
  { id: 'utility_bills', label: 'Electricity' },
];

export const STATUS_OPTIONS = [
  { id: 'all', label: 'All Status' },
  { id: '1', label: 'Successful' },
  { id: '0', label: 'Pending' },
  { id: '-1', label: 'Failed' },
];

export function formatDate(isoString) {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '';
  const time = date.toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
  const day = date.getDate();
  const suffix = day % 10 === 1 && day !== 11 ? 'st' : day % 10 === 2 && day !== 12 ? 'nd' : day % 10 === 3 && day !== 13 ? 'rd' : 'th';
  const month = date.toLocaleDateString('en-NG', { month: 'long' });
  return `${time} ${day}${suffix} ${month}, ${date.getFullYear()}`;
}

// Compact form for the Home widget: "Today, 10:24 AM" / "Yesterday, 9:02 AM"
// / "3 Jul, 9:02 AM".
export function formatDateShort(isoString) {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '';
  const time = date.toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit', hour12: true });

  const today = new Date();
  const isSameDay = (a, b) =>
    a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();

  if (isSameDay(date, today)) return `Today, ${time}`;

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameDay(date, yesterday)) return `Yesterday, ${time}`;

  const day = date.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' });
  return `${day}, ${time}`;
}

export function toDateParam(date) {
  return date.toISOString().slice(0, 10);
}
