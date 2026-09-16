/**
 * Dizajn 23: the category attributes from wizard step 6 that cap a listing's
 * guests together with its own maxGuests; the lower of the two applies.
 */
export const GUEST_CAPACITY_ATTRIBUTE_KEYS = ['kapacitet_ljudi', 'kapacitet_dece'];

/** A category that asks for this attribute (Igraonice) counts its guests as children. */
export const CHILD_CAPACITY_ATTRIBUTE_KEY = 'kapacitet_dece';

export type GuestUnit = 'children' | 'guests';

/**
 * Dizajn 31/34: "18 dece" or "30 gostiju" in a booking row, by the listing's
 * category. Takes the categories of a whole list at once, since the taxonomy
 * resolves (and caches) the attributes per category.
 */
export async function getGuestUnits(
  taxonomy: { resolveAttributesForCategory(categoryId: string): Promise<Array<{ key: string }>> },
  categoryIds: string[],
): Promise<Map<string, GuestUnit>> {
  const unique = [...new Set(categoryIds)];
  const entries = await Promise.all(
    unique.map(async (id) => {
      const attributes = await taxonomy.resolveAttributesForCategory(id);
      const unit: GuestUnit = attributes.some((a) => a.key === CHILD_CAPACITY_ATTRIBUTE_KEY) ? 'children' : 'guests';
      return [id, unit] as const;
    }),
  );
  return new Map(entries);
}
