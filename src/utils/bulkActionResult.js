import { toast } from 'react-toastify'

// The authorize and audit routes answer HTTP 200 even when they left out some, or all, of the
// selected transactions. What really happened is in the body:
//   data.totalModified        how many were changed
//   data.skippedTransactions  [{ id, reason }] for the ones that were not
// The screens used to show "... successfully!" for any HTTP 200. This shows what happened.

const TOAST = {
  position: 'top-right',
  hideProgressBar: false,
  closeOnClick: true,
  pauseOnHover: true,
  draggable: true,
  theme: 'colored',
}

const count = (n) => `${n} transaction${n === 1 ? '' : 's'}`

// "Reason A (2); Reason B": each different reason once, with how many rows it applies to.
export const summariseSkipped = (skipped = []) => {
  const reasons = new Map()
  skipped.forEach((item) => {
    const reason = (item && item.reason) || 'No reason given'
    reasons.set(reason, (reasons.get(reason) || 0) + 1)
  })
  return [...reasons.entries()].map(([reason, n]) => (n > 1 ? `${reason} (${n})` : reason)).join('; ')
}

// The message for one answer: { level: 'success' | 'warning' | 'error', text }.
// `done` is the past participle shown to the user: 'authorized' or 'audited'.
export const bulkResultMessage = (json, done) => {
  const modified = Number(json?.data?.totalModified) || 0
  const skipped = Array.isArray(json?.data?.skippedTransactions) ? json.data.skippedTransactions : []
  const why = summariseSkipped(skipped)

  if (modified > 0 && skipped.length === 0) {
    return { level: 'success', text: `${count(modified)} ${done}.` }
  }
  if (modified > 0) {
    return { level: 'warning', text: `${count(modified)} ${done}. ${count(skipped.length)} not ${done}: ${why}` }
  }
  return { level: 'error', text: `No transaction was ${done}${why ? `: ${why}` : '.'}` }
}

/**
 * Shows the result of an authorize / audit request and returns how many rows were changed.
 * Throws for an HTTP error or an `error: true` body, with the server's message when it has one.
 */
export async function showBulkResult(response, done) {
  let json = {}
  try {
    json = await response.json()
  } catch (e) {
    /* no JSON body */
  }
  if (!response.ok || json.error) {
    throw new Error(json.message || `The transactions could not be ${done}. Please try again.`)
  }
  const { level, text } = bulkResultMessage(json, done)
  // A message that says something was NOT done stays longer, so it can be read.
  toast[level](text, { ...TOAST, autoClose: level === 'success' ? 3000 : 12000 })
  return Number(json?.data?.totalModified) || 0
}
