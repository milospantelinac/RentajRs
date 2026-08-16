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
