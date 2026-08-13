// No `g` flag: these are only ever used with .test(), where a global flag
// would make matching stateful (lastIndex persists between calls on the
// same regex object) and silently miss matches on alternating calls.
const PHONE_REGEX = /(\+?\d[\d\s().-]{7,}\d)/;
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const URL_REGEX = /(https?:\/\/|www\.)\S+/i;
const SOCIAL_HANDLE_REGEX = /(instagram|facebook|viber|whatsapp|telegram)[\s:]*@?[\w.]+/i;

/**
 * R78/R79/description-check in Ch.4.6: detect phone numbers, emails, links
 * or social handles in free text. Used both for the listing-description
 * warning (moderation check) and for flagging in-message contact sharing
 * before a booking is confirmed. Only a boolean flag is ever stored —
 * never the extracted value itself (privacy).
 */
export function containsContactInfo(text: string): boolean {
  if (!text) return false;
  return (
    PHONE_REGEX.test(text) ||
    EMAIL_REGEX.test(text) ||
    URL_REGEX.test(text) ||
    SOCIAL_HANDLE_REGEX.test(text)
  );
}
