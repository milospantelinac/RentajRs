"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PAYMENT_REPORT_HOLD_MS = exports.OPEN_PAYMENT_REPORT = exports.OPEN_DISPUTE_STATUSES = void 0;
exports.isHeldByPaymentReport = isHeldByPaymentReport;
exports.OPEN_DISPUTE_STATUSES = ['NEW', 'IN_PROGRESS'];
exports.OPEN_PAYMENT_REPORT = {
    type: 'UNCONFIRMED_PAYMENT',
    status: { in: exports.OPEN_DISPUTE_STATUSES },
};
exports.PAYMENT_REPORT_HOLD_MS = 7 * 86_400_000;
function isHeldByPaymentReport(booking, now = Date.now()) {
    if (!booking.paymentDeadline || booking.disputes.length === 0)
        return false;
    return now < booking.paymentDeadline.getTime() + exports.PAYMENT_REPORT_HOLD_MS;
}
//# sourceMappingURL=payment-report.js.map