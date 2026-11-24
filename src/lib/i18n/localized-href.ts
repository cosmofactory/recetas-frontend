import type { Locale } from './locales.ts';
import { soleVariationOf, type VariationTarget } from '#lib/content/dish-variations.ts';
import { isSpainWide, SPAIN_WIDE_KEY } from '#lib/content/spain-wide.ts';

export type { VariationTarget };

// Prefixes a locale-free app path ("/dishes/tortilla", "/?tab=popular") with
// the locale. Every internal link goes through this (pnpm check:strings).
export function localizedHref(path: string, lang: Locale | string): string {
	return `/${lang}${path}`;
}

// A dish's Variations page, /:lang/dishes/:dishKey.
export const variationsHref = (dishKey: string, lang: Locale | string): string =>
	localizedHref(`/dishes/${dishKey}`, lang);

// A variation's Recipe page, /:lang/dishes/:dishKey/:regionKey.
export const recipeHref = (dishKey: string, regionKey: string, lang: Locale | string): string =>
	localizedHref(`/dishes/${dishKey}/${regionKey}`, lang);

// A region on the home map, /:lang/regions/:regionKey.
export const regionHref = (regionKey: string, lang: Locale | string): string =>
	localizedHref(`/regions/${regionKey}`, lang);

// A variation's Recipe page: /:lang/dishes/:dishKey/:regionKey, or for a
// Spanish variation /:lang/dishes/:dishKey/esp/:variationSlug (BE-9).
export function variationRecipeHref(
	dishKey: string,
	variation: VariationTarget,
	lang: Locale | string
): string {
	if (!isSpainWide(variation)) return recipeHref(dishKey, variation.regionKey, lang);
	if (!variation.variationSlug) {
		throw new Error(`Spanish variation of ${dishKey} has no slug`);
	}
	return localizedHref(`/dishes/${dishKey}/${SPAIN_WIDE_KEY}/${variation.variationSlug}`, lang);
}

// Where a link to a dish goes: its Variations page, or its only recipe.
export function dishHref(
	dish: { key: string; variations: readonly VariationTarget[] },
	lang: Locale | string
): string {
	const only = soleVariationOf(dish);
	return only ? variationRecipeHref(dish.key, only, lang) : variationsHref(dish.key, lang);
}
