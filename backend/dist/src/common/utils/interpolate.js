"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.interpolate = interpolate;
function interpolate(template, context) {
    if (!context)
        return template;
    return template.replace(/\{(\w+)\}/g, (match, key) => context[key] !== undefined ? String(context[key]) : match);
}
//# sourceMappingURL=interpolate.js.map