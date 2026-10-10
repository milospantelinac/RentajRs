import { Prisma } from '@prisma/client';
import { paraToRsd } from './money';

/**
 * Dizajn 3 and 36: everything a listing card shows, and nothing more. Search
 * results, similar listings and the saved list all read this one shape, so the
 * card looks the same everywhere and never carries the address, the iCal
 * export token or anything else the public page keeps back.
 *
 * Same last-approved-state guarantee as getPublicBySlug (R32): a card never
 * shows a photo the listing's own page would hide because it is pending removal
 * or still awaiting approval.
 */
export const LISTING_CARD_INCLUDE = {
  photos: { where: { isCover: true, pendingRemoval: false, versionId: null }, take: 1 },
  // T129: the parent's key facts stand in for a category without its own.
  category: { include: { parent: { select: { cardFactKeys: true } } } },
  city: true,
  cityArea: true,
  // Dizajn 3/4: the card's key-facts strip reads real attribute values; the
  // category's cardFactKeys say which three and in what order (T129, set in
  // the panel), utils/keyFacts.js formats them.
  attributes: { include: { attribute: { select: { key: true, unit: true, type: true, icon: true } } } },
} satisfies Prisma.ListingInclude;

export type ListingCardRow = Prisma.ListingGetPayload<{ include: typeof LISTING_CARD_INCLUDE }>;

type CardNameSource = {
  getCategoryNames(ids: string[]): Promise<Map<string, string>>;
  getOptionNames(ids: string[]): Promise<Map<string, string>>;
};

/** Category and option display names for a page of cards, in two batched lookups. */
export async function loadListingCardNames(taxonomy: CardNameSource, rows: ListingCardRow[]) {
  const optionIds = [...new Set(rows.flatMap((row) => row.attributes.flatMap((a) => a.valueOptionIds)))];
  const [categoryNames, optionNames] = await Promise.all([
    taxonomy.getCategoryNames(rows.map((row) => row.category.id)),
    optionIds.length ? taxonomy.getOptionNames(optionIds) : Promise.resolve(new Map<string, string>()),
  ]);
  return { categoryNames, optionNames };
}

export function serializeListingCard(
  listing: ListingCardRow,
  categoryNames: Map<string, string>,
  optionNames: Map<string, string>,
) {
  return {
    id: listing.id,
    slug: listing.slug,
    title: listing.title,
    price: paraToRsd(listing.price),
    priceUnit: listing.priceUnit,
    avgRating: listing.avgRating,
    reviewCount: listing.reviewCount,
    bookingModel: listing.bookingModel,
    // T121: on defined slots the price is the lowest slot ahead, "Od X RSD".
    slotSubmode: listing.slotSubmode,
    city: listing.city,
    cityArea: listing.cityArea,
    category: {
      id: listing.category.id,
      slug: listing.category.slug,
      icon: listing.category.icon,
      name: categoryNames.get(listing.category.id) ?? listing.category.slug,
      cardFactKeys: listing.category.cardFactKeys.length
        ? listing.category.cardFactKeys
        : (listing.category.parent?.cardFactKeys ?? []),
    },
    coverPhoto: listing.photos[0] ?? null,
    latitude: listing.latitude,
    longitude: listing.longitude,
    // Dizajn 3/4: raw values for the key-facts strip; utils/keyFacts.js on the
    // frontend picks which three to show and formats them per category.
    attributes: listing.attributes.map((a) => ({
      key: a.attribute.key,
      type: a.attribute.type,
      unit: a.attribute.unit,
      icon: a.attribute.icon,
      valueNumber: a.valueNumber !== null ? Number(a.valueNumber) : null,
      valueText: a.valueText,
      valueBoolean: a.valueBoolean,
      optionNames: a.valueOptionIds.map((id) => optionNames.get(id)).filter(Boolean),
    })),
  };
}
