"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PEOPLE_ROOT_CATEGORY_SLUG = exports.CHILD_CAPACITY_ATTRIBUTE_KEY = exports.GUEST_CAPACITY_ATTRIBUTE_KEYS = void 0;
exports.getGuestUnits = getGuestUnits;
exports.GUEST_CAPACITY_ATTRIBUTE_KEYS = ['kapacitet_ljudi', 'kapacitet_dece'];
exports.CHILD_CAPACITY_ATTRIBUTE_KEY = 'kapacitet_dece';
exports.PEOPLE_ROOT_CATEGORY_SLUG = 'nekretnine';
async function getGuestUnits(taxonomy, categoryIds) {
    const unique = [...new Set(categoryIds)];
    const rootSlugs = new Map();
    const walk = (node, rootSlug) => {
        rootSlugs.set(node.id, rootSlug);
        node.children?.forEach((child) => walk(child, rootSlug));
    };
    (await taxonomy.getCategoryTree()).forEach((root) => walk(root, root.slug));
    const entries = await Promise.all(unique.map(async (id) => {
        const attributes = await taxonomy.resolveAttributesForCategory(id);
        let unit = 'guests';
        if (attributes.some((a) => a.key === exports.CHILD_CAPACITY_ATTRIBUTE_KEY))
            unit = 'children';
        else if (rootSlugs.get(id) === exports.PEOPLE_ROOT_CATEGORY_SLUG)
            unit = 'people';
        return [id, unit];
    }));
    return new Map(entries);
}
//# sourceMappingURL=guest-capacity.js.map