"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toNestPaySafeAscii = toNestPaySafeAscii;
const SERBIAN_LATIN_MAP = {
    č: 'c', ć: 'c', š: 's', ž: 'z', đ: 'dj',
    Č: 'C', Ć: 'C', Š: 'S', Ž: 'Z', Đ: 'Dj',
};
function toNestPaySafeAscii(text) {
    if (!text)
        return text;
    const transliterated = text.replace(/[čćšžđČĆŠŽĐ]/g, (ch) => SERBIAN_LATIN_MAP[ch] ?? ch);
    return transliterated
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[‐-―]/g, '-')
        .replace(/[‘’]/g, "'")
        .replace(/[“”]/g, '"')
        .replace(/[^\x00-\x7F]/g, '');
}
//# sourceMappingURL=ascii-transliterate.js.map