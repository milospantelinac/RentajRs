"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatRsd = formatRsd;
exports.formatDate = formatDate;
exports.formatDateTime = formatDateTime;
exports.localeFor = localeFor;
const money_1 = require("../../common/utils/money");
function formatRsd(para) {
    const rsd = typeof para === 'bigint' ? (0, money_1.paraToRsd)(para) : para;
    if (rsd === null || rsd === undefined)
        return '';
    return `${new Intl.NumberFormat('sr-RS').format(rsd)} RSD`;
}
function formatDate(date, locale) {
    if (!date)
        return '';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
}
function formatDateTime(date, locale) {
    if (!date)
        return '';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleString(locale, { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function localeFor(language) {
    return language === 'EN' ? 'en-US' : 'sr-Latn-RS';
}
//# sourceMappingURL=format.js.map