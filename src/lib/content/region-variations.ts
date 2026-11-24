import type { components } from '#lib/api/schema.d.ts';
import { isSpainWide } from './spain-wide.ts';

type Dish = components['schemas']['Dish'];

// One row of the region sheet / panel: a dish's variation for the region,
// with its dish key (the recipe URL is /:lang/dishes/:dishKey/:regionKey).
export type RegionVariationRow = Dish['variations'][number] & { dishKey: string };

// Only Spanish variations have no rank, and they are never in a region's list.
const rankOf = (row: RegionVariationRow) => row.regionRank ?? 0;
const byRegionRank = (a: RegionVariationRow, b: RegionVariationRow) => rankOf(a) - rankOf(b);

// Mobile README -> Region sheet: "this region's variation of each popular
// dish (from dishes[].variations where regionKey matches)", ordered by
// regionRank: the backend's importance order for the region (stack.md X15).
// The given list is left as it is. Spanish (esp) variations are in no
// region's list, and esp is not a region (FE-11).
export function regionVariations(regionKey: string, dishes: readonly Dish[]): RegionVariationRow[] {
	if (isSpainWide({ regionKey })) return [];
	const rows = dishes.flatMap((dish) => {
		const variation = dish.variations.find((v) => v.regionKey === regionKey);
		return variation ? [{ dishKey: dish.key, ...variation }] : [];
	});
	return rows.sort(byRegionRank);
}
