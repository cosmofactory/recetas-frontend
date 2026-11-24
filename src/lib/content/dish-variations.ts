// What decides a variation's Recipe URL: its region, or its slug when
// Spanish (BE-9 D-ESP-2).
export type VariationTarget = { regionKey: string; variationSlug: string | null };

// A dish with exactly one variation has no Variations page: its URL 301s to
// that recipe, and every link to the dish goes there (FE-11).
export const hasVariationsPage = (dish: { variations: readonly unknown[] }): boolean =>
	dish.variations.length !== 1;

// The only variation of a dish without a Variations page, else undefined.
export function soleVariationOf<V>(dish: { variations: readonly V[] }): V | undefined {
	return hasVariationsPage(dish) ? undefined : dish.variations[0];
}
