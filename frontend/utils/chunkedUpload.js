// Sends a large file to the backend in parts (the homepage video, which has
// no size limit): one PUT per part with the bytes as application/octet-stream
// at the offset the server has reached. No proxy limit on a request body
// stops it, a dropped connection costs one part, and after an error the
// server is asked how far it got.

export const START_PART_BYTES = 8 * 1024 * 1024
export const MIN_PART_BYTES = 1024 * 1024
const MAX_ATTEMPTS = 8

/** The HTTP status an API error carries, or undefined when no answer came (a dropped connection). */
export function errorStatus(error) {
  return error?.response?.status ?? error?.statusCode ?? error?.status
}

/**
 * Whether a failure is worth retrying: no answer at all, a part too large for
 * a proxy (413), a conflict about where the upload is (409), a timeout or the
 * server being restarted (5xx). Any other refusal (not a video, no
 * permission, the upload gone) is final.
 */
export function isRetryable(status) {
  if (status === undefined || status === null) return true
  return status === 408 || status === 409 || status === 413 || status === 425 || status === 429 || status >= 500
}

export function backoffMs(attempt) {
  return Math.min(30_000, 1000 * 2 ** (attempt - 1))
}

// Parts sent in a row after which a part halved by a dropped connection grows back.
const GROW_AFTER = 4

/**
 * Uploads `file` into the upload `upload` ({ id, received }) from where the
 * server is. A 413, or no answer at all (a proxy refusing a large body may
 * close the connection), halves the part, down to 1 MB. A 413 also caps the
 * part for the rest of the upload; after a dropped connection the part grows
 * back once a few have gone through, unless that size dropped before. Resolves
 * with the bytes the server holds once it has them all; rejects with the last
 * error after eight failures in a row, or at once for a final refusal or an abort.
 */
export async function uploadInParts({ api, url, file, upload, signal, onProgress, onRetry, partBytes = START_PART_BYTES }) {
  let received = upload.received
  let size = partBytes
  // The largest part this route is known to take.
  let ceiling = partBytes
  let droppedAt = 0
  let streak = 0
  let failures = 0
  onProgress?.(received)

  while (received < file.size) {
    throwIfAborted(signal)
    const end = Math.min(received + size, file.size)
    try {
      const answer = await api.put(`${url}/${upload.id}?offset=${received}`, file.slice(received, end), {
        headers: { 'Content-Type': 'application/octet-stream' },
        signal,
      })
      received = answer.received
      failures = 0
      streak += 1
      if (streak >= GROW_AFTER && size < ceiling) {
        size = Math.min(ceiling, size * 2)
        streak = 0
      }
      onProgress?.(received)
    } catch (error) {
      throwIfAborted(signal)
      const status = errorStatus(error)
      if (!isRetryable(status)) throw error
      failures += 1
      streak = 0
      if (failures >= MAX_ATTEMPTS) throw error
      if (status === 413 || status === undefined) {
        // A proxy's limit (a 413, or the same size dropping twice) holds for the rest of the upload.
        if (status === 413 || droppedAt === size) ceiling = Math.max(MIN_PART_BYTES, Math.floor(size / 2))
        if (status === undefined) droppedAt = size
        size = Math.max(MIN_PART_BYTES, Math.min(ceiling, Math.floor(size / 2)))
      }
      onRetry?.(failures)
      await wait(backoffMs(failures), signal)
      received = await serverReceived({ api, url, upload, signal, fallback: received })
      onProgress?.(received)
    }
  }
  return received
}

// How far the server got; when even that fails, the next attempt is sent
// from where the page thinks it is, and a wrong guess comes back as a 409.
async function serverReceived({ api, url, upload, signal, fallback }) {
  try {
    return (await api.get(`${url}/${upload.id}`, { signal })).received
  } catch (error) {
    throwIfAborted(signal)
    if (!isRetryable(errorStatus(error))) throw error
    return fallback
  }
}

function throwIfAborted(signal) {
  if (signal?.aborted) throw new DOMException('The upload was cancelled', 'AbortError')
}

function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(new DOMException('The upload was cancelled', 'AbortError'))
      },
      { once: true },
    )
  })
}

/** Bytes as the admin reads them: 1000-based, as Administracija > Skladište shows them. */
export function formatFileSize(bytes) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1000)))
  return `${(bytes / 1000 ** index).toLocaleString('sr-RS', { maximumFractionDigits: index ? 1 : 0 })} ${units[index]}`
}
