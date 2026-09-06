"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BELGRADE_TZ = void 0;
exports.toBelgradeHHMM = toBelgradeHHMM;
exports.toBelgradeDateOnly = toBelgradeDateOnly;
exports.toBelgradeISODayOfWeek = toBelgradeISODayOfWeek;
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
//# sourceMappingURL=timezone.js.map