"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_REQUEST_RESPONSE_HOURS = exports.REQUEST_RESPONSE_HOURS_SETTING = void 0;
exports.readRequestResponseHours = readRequestResponseHours;
exports.getRequestExpiresAt = getRequestExpiresAt;
const HOUR_MS = 3_600_000;
exports.REQUEST_RESPONSE_HOURS_SETTING = 'booking_request_response_hours';
exports.DEFAULT_REQUEST_RESPONSE_HOURS = 48;
async function readRequestResponseHours(prisma) {
    const setting = await prisma.setting.findUnique({ where: { key: exports.REQUEST_RESPONSE_HOURS_SETTING } });
    const hours = setting?.value;
    return typeof hours === 'number' && hours > 0 ? hours : exports.DEFAULT_REQUEST_RESPONSE_HOURS;
}
function getRequestExpiresAt(booking, hours) {
    return new Date(Math.min(booking.createdAt.getTime() + hours * HOUR_MS, booking.startsAt.getTime()));
}
//# sourceMappingURL=request-expiry.js.map