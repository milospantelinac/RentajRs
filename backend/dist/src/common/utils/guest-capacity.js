"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CHILD_CAPACITY_ATTRIBUTE_KEY = exports.GUEST_CAPACITY_ATTRIBUTE_KEYS = void 0;
exports.getGuestUnits = getGuestUnits;
exports.GUEST_CAPACITY_ATTRIBUTE_KEYS = ['kapacitet_ljudi', 'kapacitet_dece'];
exports.CHILD_CAPACITY_ATTRIBUTE_KEY = 'kapacitet_dece';
async function getGuestUnits(taxonomy, categoryIds) {
    const unique = [...new Set(categoryIds)];
    const entries = await Promise.all(unique.map(async (id) => {
        const attributes = await taxonomy.resolveAttributesForCategory(id);
        const unit = attributes.some((a) => a.key === exports.CHILD_CAPACITY_ATTRIBUTE_KEY) ? 'children' : 'guests';
        return [id, unit];
    }));
    return new Map(entries);
}
//# sourceMappingURL=guest-capacity.js.map