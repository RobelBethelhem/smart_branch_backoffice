import { API_BASE_URL } from 'src/config/api'

// Customer photo + specimen signature for the detail panel, loaded when a row is opened.
//
// The Authorize / Audit / Reassignment lists used to carry both images for every row, read
// from FlexCube on every refresh of the list. The lists no longer include them; the panel
// gets them here (as the teller queue in Approval/approval.js already did).
//
// Answers are kept for ten minutes per account, so reopening a row, or opening several
// transactions of one customer, does not ask FlexCube again.

const KEEP_MS = 10 * 60 * 1000
const MAX_ACCOUNTS = 50

const cache = new Map() // account number -> { at, promise }

/**
 * @returns {Promise<{profile_image: string|null, sign_image: string|null} | null>}
 *          null when there is no account number or the images could not be loaded.
 */
export function fetchAccountImages(accountNumber, accessToken) {
  if (!accountNumber) return Promise.resolve(null)

  const cached = cache.get(accountNumber)
  if (cached && Date.now() - cached.at < KEEP_MS) return cached.promise

  const entry = { at: Date.now(), promise: null }
  entry.promise = fetch(
    `${API_BASE_URL}/api/zsmart_branch_requests/account_images/${encodeURIComponent(accountNumber)}`,
    { headers: { 'Content-Type': 'application/json', 'x-access-token': accessToken } },
  )
    .then((response) => response.json())
    .then((json) => (!json.error && json.data ? json.data : null))
    .catch(() => null)
    .then((images) => {
      // Remember only real images. A failure, or an answer with no images (which is also what
      // the server sends when FlexCube could not be reached), is asked again on the next open.
      const hasImage = !!images && (!!images.profile_image || !!images.sign_image)
      if (!hasImage && cache.get(accountNumber) === entry) cache.delete(accountNumber)
      return images
    })

  cache.delete(accountNumber)
  cache.set(accountNumber, entry)
  // Images are large; keep only the most recent accounts.
  while (cache.size > MAX_ACCOUNTS) cache.delete(cache.keys().next().value)

  return entry.promise
}
