// Shared wording and number formats for the Branch Record screens, so the table, the two
// statistics tabs and the export all describe a request the same way.

const MONEY = new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'ETB', minimumFractionDigits: 2, maximumFractionDigits: 2,
});
const COUNT = new Intl.NumberFormat('en-US');
const COMPACT = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

// "ETB 1,234,567.89" — always the exact figure.
export const formatMoney = (amount) => MONEY.format(Number(amount) || 0);
export const formatCount = (count) => COUNT.format(Number(count) || 0);
// "1.2M" — only for chart axes, where there is no room for the exact figure.
export const formatCompact = (value) => COMPACT.format(Number(value) || 0);

// 12 -> "12 min", 135 -> "2h 15m", 3000 -> "2d 2h"
export const formatDuration = (minutes) => {
  const value = Number(minutes) || 0;
  if (value < 60) return `${Math.round(value * 10) / 10} min`;
  const whole = Math.round(value);
  if (whole < 1440) return `${Math.floor(whole / 60)}h ${whole % 60}m`;
  return `${Math.floor(whole / 1440)}d ${Math.floor((whole % 1440) / 60)}h`;
};

const TYPE_LABELS = {
  deposit: 'Deposit',
  withdraw: 'Withdraw',
  echeck: 'E-Cheque',
  transfer: 'Transfer',
  other_bank_transfer: 'Other Bank Transfer',
  'other-bank-transfer': 'Other Bank Transfer',
  air_ticket_payment: 'Air Ticket Payment',
};

const STATUS_LABELS = {
  requested: 'Requested',
  assigned_by_csr: 'Assigned by CSR',
  assigned: 'Assigned',
  pending_checker: 'Pending Checker',
  posted: 'Posted',
  authorized: 'Authorized',
  audited: 'Audited',
  delayed: 'Delayed',
  rejected: 'Rejected',
};

const tidy = (key) => {
  const text = String(key || 'Unknown').replace(/[_-]/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
};

export const typeLabel = (type) => TYPE_LABELS[String(type || '').toLowerCase()] || tidy(type);
export const statusLabel = (status) => STATUS_LABELS[String(status || '').toLowerCase()] || tidy(status);

// A request that is still open on a later day than the one it was made. Its reference code
// stopped working at midnight, so no teller can serve it any more (same rule as the server's
// statistics: utils/rms/branchStats.js in the backend).
const EXPIRING_STATUSES = ['requested', 'assigned', 'assigned_by_csr', 'delayed'];
export const isNotServed = (row, now = new Date()) => {
  if (!row || !EXPIRING_STATUSES.includes(row.status) || !row.request_date) return false;
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  return new Date(row.request_date) < startOfToday;
};
