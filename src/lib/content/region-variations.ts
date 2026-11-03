import type { components } from '#lib/api/schema.d.ts';

type Dish = components['schemas']['Dish'];

// One row of the region sheet / panel: a dish's variation for the region,
// with its dish key (the recipe URL is /:lang/dishes/:dishKey/:regionKey).
export type RegionVariationRow = Dish['variations'][number] & { dishKey: string };

const byRegionRank = (a: RegionVariationRow, b: RegionVariationRow) => a.regionRank - b.regionRank;

// Mobile README -> Region sheet: "this region's variation of each popular
// dish (from dishes[].variations where regionKey matches)", ordered by
// regionRank: the backend's importance order for the region (stack.md X15).
// The given list is left as it is.
export function regionVariations(regionKey: string, dishes: readonly Dish[]): RegionVariationRow[] {
	const rows = dishes.flatMap((dish) => {
		const variation = dish.variations.find((v) => v.regionKey === regionKey);
		return variation ? [{ dishKey: dish.key, ...variation }] : [];
	});
	return rows.sort(byRegionRank);
}
