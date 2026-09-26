/**
 * Dizajn 23: the category attributes from wizard step 6 that cap a listing's
 * guests together with its own maxGuests; the lower of the two applies.
 */
export const GUEST_CAPACITY_ATTRIBUTE_KEYS = ['kapacitet_ljudi', 'kapacitet_dece'];

/** A category that asks for this attribute (Igraonice) counts its guests as children. */
export const CHILD_CAPACITY_ATTRIBUTE_KEY = 'kapacitet_dece';

/** Dizajn 39: a stay (Stanovi, Kuće, Sobe) counts people, "2 osobe" as 528:514 has it. */
export const PEOPLE_ROOT_CATEGORY_SLUG = 'nekretnine';

export type GuestUnit = 'children' | 'people' | 'guests';

type CategoryNode = { id: string; slug: string; children?: CategoryNode[] };

/**
 * Dizajn 31/34/39: "18 dece", "2 osobe" or "30 gostiju" in a booking row, by
 * the listing's category. Takes the categories of a whole list at once, since
 * the taxonomy resolves (and caches) the attributes and the tree.
 */
export async function getGuestUnits(
  taxonomy: {
    resolveAttributesForCategory(categoryId: string): Promise<Array<{ key: string }>>;
    getCategoryTree(): Promise<CategoryNode[]>;
  },
  categoryIds: string[],
): Promise<Map<string, GuestUnit>> {
  const unique = [...new Set(categoryIds)];
  const rootSlugs = new Map<string, string>();
  const walk = (node: CategoryNode, rootSlug: string) => {
    rootSlugs.set(node.id, rootSlug);
    node.children?.forEach((child) => walk(child, rootSlug));
  };
  (await taxonomy.getCategoryTree()).forEach((root) => walk(root, root.slug));

  const entries = await Promise.all(
    unique.map(async (id) => {
      const attributes = await taxonomy.resolveAttributesForCategory(id);
      let unit: GuestUnit = 'guests';
      if (attributes.some((a) => a.key === CHILD_CAPACITY_ATTRIBUTE_KEY)) unit = 'children';
      else if (rootSlugs.get(id) === PEOPLE_ROOT_CATEGORY_SLUG) unit = 'people';
      return [id, unit] as const;
    }),
  );
  return new Map(entries);
}
