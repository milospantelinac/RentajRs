"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.containsContactInfo = containsContactInfo;
const PHONE_REGEX = /(\+?\d[\d\s().-]{7,}\d)/;
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const URL_REGEX = /(https?:\/\/|www\.)\S+/i;
const SOCIAL_HANDLE_REGEX = /(instagram|facebook|viber|whatsapp|telegram)[\s:]*@?[\w.]+/i;
function containsContactInfo(text) {
    if (!text)
        return false;
    return (PHONE_REGEX.test(text) ||
        EMAIL_REGEX.test(text) ||
        URL_REGEX.test(text) ||
        SOCIAL_HANDLE_REGEX.test(text));
}
//# sourceMappingURL=contact-detector.js.map