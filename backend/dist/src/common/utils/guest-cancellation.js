"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFreeCancellationUntil = getFreeCancellationUntil;
exports.canGuestCancel = canGuestCancel;
const HOUR_MS = 3_600_000;
function getFreeCancellationUntil(booking) {
    const threshold = booking.cancellationThreshold;
    if (!threshold || threshold <= 0)
        return null;
    if (booking.cancellationPolicyType === 'FREE_UNTIL_DAYS') {
        return new Date(booking.startsAt.getTime() - threshold * 24 * HOUR_MS);
    }
    if (booking.cancellationPolicyType === 'FREE_UNTIL_HOURS') {
        return new Date(booking.startsAt.getTime() - threshold * HOUR_MS);
    }
    return null;
}
function canGuestCancel(booking, now = new Date()) {
    if (booking.status === 'REQUESTED' || booking.status === 'AWAITING_PAYMENT')
        return true;
    if (booking.status !== 'CONFIRMED' || booking.paymentMethod !== 'CASH')
        return false;
    const until = getFreeCancellationUntil(booking);
    return !!until && now.getTime() < until.getTime();
}
//# sourceMappingURL=guest-cancellation.js.map