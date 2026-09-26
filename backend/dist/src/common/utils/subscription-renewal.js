"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PACKAGE_ENDING_WITHOUT_RENEWAL = exports.LISTING_LEAVES_SEARCH_AT_END = exports.RENEWABLE_SUBSCRIPTION_STATUSES = exports.DAY_MS = void 0;
exports.cycleLength = cycleLength;
exports.addDays = addDays;
exports.isRunningPeriod = isRunningPeriod;
exports.DAY_MS = 86_400_000;
function cycleLength(billingCycle) {
    return billingCycle === 'YEARLY' ? 365 : 30;
}
function addDays(date, days) {
    return new Date(date.getTime() + days * exports.DAY_MS);
}
exports.RENEWABLE_SUBSCRIPTION_STATUSES = ['ACTIVE', 'EXPIRED'];
function isRunningPeriod(subscription, now = new Date()) {
    if (subscription.status === 'SCHEDULED')
        return true;
    return subscription.status === 'ACTIVE' && !!subscription.expiresAt && subscription.expiresAt > now;
}
exports.LISTING_LEAVES_SEARCH_AT_END = {
    status: { not: 'DELETED' },
    bankedDays: { none: { usedAt: null, validUntil: null } },
};
exports.PACKAGE_ENDING_WITHOUT_RENEWAL = {
    status: 'ACTIVE',
    renewals: { none: { status: 'SCHEDULED' } },
    listings: { some: exports.LISTING_LEAVES_SEARCH_AT_END },
};
//# sourceMappingURL=subscription-renewal.js.map