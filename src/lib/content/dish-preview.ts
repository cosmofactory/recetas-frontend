import type { components } from '#lib/api/schema.d.ts';
import { DOT_SEPARATOR } from '#lib/i18n/format.ts';

type Dish = components['schemas']['Dish'];

// Mobile README -> Popular tab: "first two variations as "Region ·
// Variation · Region · Variation"". The API sends them in region order.
const PREVIEW_VARIATIONS = 2;

export const dishPreview = (dish: Pick<Dish, 'variations'>): string =>
	dish.variations
		.slice(0, PREVIEW_VARIATIONS)
		.map((variation) => [variation.regionName, variation.name].join(DOT_SEPARATOR))
		.join(DOT_SEPARATOR);
