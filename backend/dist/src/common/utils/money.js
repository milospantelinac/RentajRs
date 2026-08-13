"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rsdToPara = rsdToPara;
exports.paraToRsd = paraToRsd;
function rsdToPara(rsd) {
    return BigInt(Math.round(rsd * 100));
}
function paraToRsd(para) {
    if (para === null || para === undefined)
        return null;
    return Number(para) / 100;
}
//# sourceMappingURL=money.js.map