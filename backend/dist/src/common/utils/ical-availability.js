"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ICAL_FAILURE_ALERT_THRESHOLD = void 0;
exports.getIcalAvailability = getIcalAvailability;
function getIcalAvailability(listing, packageHasIcal) {
    if (listing.bookingModel !== 'PER_STAY' || listing.priceUnit === 'MONTH')
        return 'NOT_STAY';
    if (listing.status !== 'ACTIVE')
        return 'NOT_PUBLISHED';
    return packageHasIcal ? 'AVAILABLE' : 'NO_ICAL_PACKAGE';
}
exports.ICAL_FAILURE_ALERT_THRESHOLD = 3;
//# sourceMappingURL=ical-availability.js.map