// Helpers for scheduled purchases (airtime, data, cable).

export const SCHEDULE_TIMEZONE = 'Africa/Lagos';

// Lagos has no daylight saving: it is UTC+1 all year, which is the +01:00 the
// API's examples use.
const LAGOS_OFFSET_MS = 60 * 60 * 1000;

export const RECURRENCES = [
  { id: 'once', label: 'Once', hint: 'Runs one time' },
  { id: 'daily', label: 'Daily', hint: 'Every day' },
  { id: 'weekly', label: 'Weekly', hint: 'Every week' },
  { id: 'monthly', label: 'Monthly', hint: 'Every month' },
];

const pad = (n) => String(n).padStart(2, '0');

// A picked Date -> "2026-10-10T09:00:00+01:00". The same instant is expressed
// on Lagos' clock, so it is correct whatever time zone the phone is set to.
export function toLagosIso(date) {
  const d = new Date(date.getTime() + LAGOS_OFFSET_MS);
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:00+01:00`
  );
}

// Shortest lead time accepted, so a schedule never lands in the past by the
// time the request reaches the server.
export const MIN_LEAD_MINUTES = 2;

export function validateStartsAt(date, now = new Date()) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return 'Pick a date and time.';
  if (date.getTime() < now.getTime() + MIN_LEAD_MINUTES * 60 * 1000) {
    return `Pick a time at least ${MIN_LEAD_MINUTES} minutes from now.`;
  }
  return null;
}

export function defaultStart(now = new Date()) {
  // Tomorrow, 9:00 am, in the phone's own clock.
  const d = new Date(now.getTime());
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d;
}

export function formatWhen(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const SERVICE_LABELS = { airtime: 'Airtime', data: 'Data', cable: 'Cable TV' };
const RECURRENCE_LABELS = { once: 'Once', daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' };

const STATUS_TONES = {
  active: { label: 'Active', tone: 'good' },
  scheduled: { label: 'Active', tone: 'good' },
  pending: { label: 'Active', tone: 'good' },
  paused: { label: 'Paused', tone: 'warn' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
  canceled: { label: 'Cancelled', tone: 'neutral' },
  completed: { label: 'Completed', tone: 'neutral' },
  failed: { label: 'Failed', tone: 'bad' },
};

export function statusInfo(status) {
  const key = String(status || '').toLowerCase();
  if (STATUS_TONES[key]) return { key, ...STATUS_TONES[key] };
  const pretty = key ? key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ') : 'Unknown';
  return { key, label: pretty, tone: 'neutral' };
}

const first = (...values) => values.find((v) => v !== undefined && v !== null && v !== '');

// The scheduling responses are not shown in the API collection, so this reads
// the likely field names rather than one fixed shape, and never throws.
export function normalizeSchedule(raw) {
  const r = raw || {};
  const purchase = r.purchase || r.payload || r.purchase_payload || {};
  const serviceType = String(first(r.service_type, r.type, '') || '').toLowerCase();
  const recurrence = String(first(r.recurrence, r.frequency, '') || '').toLowerCase();
  const recipient = first(
    purchase.phone_number,
    purchase.smart_card_number,
    r.phone_number,
    r.smart_card_number,
    r.recipient
  );
  const amount = first(purchase.amount, r.amount, purchase.price, r.price);
  const plan = first(r.plan_name, r.product_plan_name, purchase.plan_name, purchase.product_plan_name, r.description, r.label);

  return {
    id: first(r.id, r.uuid, r.schedule_id),
    serviceType,
    serviceLabel: SERVICE_LABELS[serviceType] || (serviceType ? serviceType : 'Purchase'),
    recurrence,
    recurrenceLabel: RECURRENCE_LABELS[recurrence] || (recurrence || ''),
    status: statusInfo(r.status),
    nextRun: first(r.next_run_at, r.next_execution_at, r.next_run, r.next_runs_at, r.starts_at),
    startsAt: first(r.starts_at, r.start_at),
    lastRun: first(r.last_run_at, r.last_executed_at, r.last_run),
    recipient: recipient ? String(recipient) : null,
    amount: amount !== undefined ? Number(amount) : null,
    plan: plan ? String(plan) : null,
    raw: r,
  };
}

export function normalizeExecution(raw) {
  const r = raw || {};
  const statusKey = String(first(r.status, r.result, '') || '').toLowerCase();
  const ok = /success|completed|done|paid/.test(statusKey);
  const bad = /fail|error|declin|reject/.test(statusKey);
  return {
    id: first(r.id, r.uuid, r.execution_id),
    when: first(r.executed_at, r.ran_at, r.run_at, r.scheduled_for, r.created_at),
    statusLabel: statusKey ? statusKey.charAt(0).toUpperCase() + statusKey.slice(1).replace(/_/g, ' ') : 'Unknown',
    tone: ok ? 'good' : bad ? 'bad' : 'neutral',
    message: first(r.message, r.failure_reason, r.reason, r.error),
    reference: first(r.reference, r.transaction_reference, r.transaction_id),
    amount: first(r.amount, r.price) !== undefined ? Number(first(r.amount, r.price)) : null,
  };
}

// The list may come back as data: [...], data: { schedules: [...] } or
// data: { data: [...] } (paginated).
export function extractList(json, ...keys) {
  const d = json?.data;
  if (Array.isArray(d)) return d;
  for (const key of [...keys, 'data', 'items', 'results']) {
    if (Array.isArray(d?.[key])) return d[key];
  }
  return [];
}
