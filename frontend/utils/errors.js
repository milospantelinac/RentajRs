// NestJS sends `message` as a string for a single-message exception (e.g.
// `throw new BadRequestException(this.i18n.t('errors.X'))`) but as an array
// for class-validator DTO failures. Indexing a string with [0] silently
// returns just its first character instead of the whole message, so the two
// shapes need to be told apart rather than assumed.
export function extractErrorMessage(error, fallback) {
  const message = error?.data?.message
  if (Array.isArray(message)) return message[0] ?? fallback
  if (typeof message === 'string' && message) return message
  return fallback
}

// What a public page throws (through createError) when the API did not give
// it its record. Only an answer about the record itself (404, or a 4xx such
// as a malformed slug) means the page does not exist. A 429 or an outage is a
// 503: a 404 there told visitors and crawlers that a live listing was gone.
export function pageLoadError(error, notFoundMessage) {
  const status = error?.statusCode ?? error?.status ?? error?.response?.status
  if (status === 429 || !(status >= 400 && status < 500)) {
    return { statusCode: 503, statusMessage: 'Service Unavailable' }
  }
  return { statusCode: 404, statusMessage: notFoundMessage }
}
