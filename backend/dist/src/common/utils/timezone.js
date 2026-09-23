"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BELGRADE_TZ = void 0;
exports.toBelgradeHHMM = toBelgradeHHMM;
exports.toBelgradeDateOnly = toBelgradeDateOnly;
exports.toBelgradeISODayOfWeek = toBelgradeISODayOfWeek;
exports.belgradeDayStart = belgradeDayStart;
exports.endOfBelgradeDayAfter = endOfBelgradeDayAfter;
exports.BELGRADE_TZ = 'Europe/Belgrade';
function toBelgradeHHMM(date) {
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: exports.BELGRADE_TZ });
}
function toBelgradeDateOnly(date) {
    const [year, month, day] = date.toLocaleDateString('en-CA', { timeZone: exports.BELGRADE_TZ }).split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day));
}
function toBelgradeISODayOfWeek(date) {
    return ((toBelgradeDateOnly(date).getUTCDay() + 6) % 7) + 1;
}
function belgradeDayStart(year, month, day) {
    const utcMidnight = Date.UTC(year, month - 1, day);
    for (const offsetHours of [1, 2]) {
        const candidate = new Date(utcMidnight - offsetHours * 3_600_000);
        if (toBelgradeHHMM(candidate) === '00:00')
            return candidate;
    }
    return new Date(utcMidnight - 3_600_000);
}
function endOfBelgradeDayAfter(from, days) {
    const [year, month, day] = from.toLocaleDateString('en-CA', { timeZone: exports.BELGRADE_TZ }).split('-').map(Number);
    const next = new Date(Date.UTC(year, month - 1, day + days + 1));
    return new Date(belgradeDayStart(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate()).getTime() - 1);
}
//# sourceMappingURL=timezone.js.map