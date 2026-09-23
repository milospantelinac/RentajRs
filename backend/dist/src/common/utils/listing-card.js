"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LISTING_CARD_INCLUDE = void 0;
exports.loadListingCardNames = loadListingCardNames;
exports.serializeListingCard = serializeListingCard;
const money_1 = require("./money");
exports.LISTING_CARD_INCLUDE = {
    photos: { where: { isCover: true, pendingRemoval: false, versionId: null }, take: 1 },
    category: true,
    city: true,
    cityArea: true,
    attributes: { include: { attribute: { select: { key: true, unit: true, type: true } } } },
};
async function loadListingCardNames(taxonomy, rows) {
    const optionIds = [...new Set(rows.flatMap((row) => row.attributes.flatMap((a) => a.valueOptionIds)))];
    const [categoryNames, optionNames] = await Promise.all([
        taxonomy.getCategoryNames(rows.map((row) => row.category.id)),
        optionIds.length ? taxonomy.getOptionNames(optionIds) : Promise.resolve(new Map()),
    ]);
    return { categoryNames, optionNames };
}
function serializeListingCard(listing, categoryNames, optionNames) {
    return {
        id: listing.id,
        slug: listing.slug,
        title: listing.title,
        price: (0, money_1.paraToRsd)(listing.price),
        priceUnit: listing.priceUnit,
        avgRating: listing.avgRating,
        reviewCount: listing.reviewCount,
        bookingModel: listing.bookingModel,
        city: listing.city,
        cityArea: listing.cityArea,
        category: {
            id: listing.category.id,
            slug: listing.category.slug,
            icon: listing.category.icon,
            name: categoryNames.get(listing.category.id) ?? listing.category.slug,
        },
        coverPhoto: listing.photos[0] ?? null,
        latitude: listing.latitude,
        longitude: listing.longitude,
        attributes: listing.attributes.map((a) => ({
            key: a.attribute.key,
            type: a.attribute.type,
            unit: a.attribute.unit,
            valueNumber: a.valueNumber !== null ? Number(a.valueNumber) : null,
            valueText: a.valueText,
            valueBoolean: a.valueBoolean,
            optionNames: a.valueOptionIds.map((id) => optionNames.get(id)).filter(Boolean),
        })),
    };
}
//# sourceMappingURL=listing-card.js.map