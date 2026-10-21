import type { components } from '#lib/api/schema.d.ts';

type Dish = components['schemas']['Dish'];

// One row of the region sheet / panel: a dish's variation for the region,
// with its dish key (the recipe URL is /:lang/dishes/:dishKey/:regionKey).
export type RegionVariationRow = Dish['variations'][number] & { dishKey: string };

const byDishOrder = (a: Dish, b: Dish) => a.order - b.order;

// Mobile README -> Region sheet: "this region's variation of each popular
// dish (from dishes[].variations where regionKey matches)", in dish order
// (RegionDetail's documented order). The given list is left as it is.
export function regionVariations(regionKey: string, dishes: readonly Dish[]): RegionVariationRow[] {
	return [...dishes].sort(byDishOrder).flatMap((dish) => {
		const variation = dish.variations.find((v) => v.regionKey === regionKey);
		return variation ? [{ dishKey: dish.key, ...variation }] : [];
	});
}
