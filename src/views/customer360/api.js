import { API_BASE_URL } from 'src/config/api';

// One place for every Customer 360 call. Throws an Error with the server's message (and
// `status`) when the call is refused, so screens can show the reason.
export async function c360Fetch(token, path, { method = 'GET', body } = {}) {
  const response = await fetch(`${API_BASE_URL}/api/customer360${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'x-access-token': token },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  let json = null;
  try {
    json = await response.json();
  } catch (error) {
    json = null;
  }

  if (!response.ok || !json || json.error) {
    const failure = new Error((json && json.message) || `The server answered ${response.status}`);
    failure.status = response.status;
    throw failure;
  }
  return json.data;
}

// ---- small formatting helpers shared by the Customer 360 screens --------------------------

export const initialsOf = (name) =>
  String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('') || '?';

export const timeOf = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
};

// 8420000 -> "8.42M", 929000 -> "929K", 310 -> "310"
export const compactNumber = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value ?? '');
  const abs = Math.abs(number);
  if (abs >= 1e9) return `${(number / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(number / 1e6).toFixed(2)}M`;
  if (abs >= 1e4) return `${Math.round(number / 1e3)}K`;
  return number.toLocaleString('en-US', { maximumFractionDigits: 2 });
};

export const fullNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString('en-US', { maximumFractionDigits: 2 }) : String(value ?? '');
};

// "Deposit · Queue 12 · Teller Hana · 19:03"
export const arrivalLine = (arrival) =>
  [
    arrival.request_label,
    arrival.account_tail ? `Account ••${arrival.account_tail}` : null,
    arrival.queue_number ? `Queue ${arrival.queue_number}` : null,
    arrival.assigned_to ? `Teller ${arrival.assigned_to}` : null,
    timeOf(arrival.arrived_at),
  ]
    .filter(Boolean)
    .join(' · ');

export const assignedByText = (arrival) =>
  arrival.assigned_by === 'teller' ? 'Taken by the teller' : 'Assigned by the system';
