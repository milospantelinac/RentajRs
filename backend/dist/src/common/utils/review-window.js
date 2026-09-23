"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_REVIEW_EDIT_DAYS = exports.REVIEW_EDIT_SETTING = exports.DEFAULT_REVIEW_WINDOW_DAYS = exports.REVIEW_WINDOW_SETTING = void 0;
exports.readReviewWindowDays = readReviewWindowDays;
exports.readReviewEditDays = readReviewEditDays;
exports.getReviewDeadline = getReviewDeadline;
exports.getReviewEditableUntil = getReviewEditableUntil;
exports.readCompletedAt = readCompletedAt;
exports.readReviewDeadline = readReviewDeadline;
const timezone_1 = require("./timezone");
exports.REVIEW_WINDOW_SETTING = 'review_window_days';
exports.DEFAULT_REVIEW_WINDOW_DAYS = 14;
exports.REVIEW_EDIT_SETTING = 'review_edit_days';
exports.DEFAULT_REVIEW_EDIT_DAYS = 7;
async function readDays(prisma, key, fallback) {
    const setting = await prisma.setting.findUnique({ where: { key } });
    const days = setting?.value;
    return typeof days === 'number' && days > 0 ? days : fallback;
}
function readReviewWindowDays(prisma) {
    return readDays(prisma, exports.REVIEW_WINDOW_SETTING, exports.DEFAULT_REVIEW_WINDOW_DAYS);
}
function readReviewEditDays(prisma) {
    return readDays(prisma, exports.REVIEW_EDIT_SETTING, exports.DEFAULT_REVIEW_EDIT_DAYS);
}
function getReviewDeadline(completedAt, windowDays) {
    return (0, timezone_1.endOfBelgradeDayAfter)(completedAt, windowDays);
}
function getReviewEditableUntil(publishedAt, editDays) {
    return (0, timezone_1.endOfBelgradeDayAfter)(publishedAt, editDays);
}
async function readCompletedAt(prisma, booking) {
    const row = await prisma.bookingHistory.findFirst({
        where: { bookingId: booking.id, newStatus: 'COMPLETED' },
        orderBy: { changedAt: 'desc' },
        select: { changedAt: true },
    });
    return row?.changedAt ?? booking.endsAt;
}
async function readReviewDeadline(prisma, booking) {
    const [completedAt, windowDays] = await Promise.all([readCompletedAt(prisma, booking), readReviewWindowDays(prisma)]);
    return getReviewDeadline(completedAt, windowDays);
}
//# sourceMappingURL=review-window.js.map