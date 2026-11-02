import type { Locale } from '#lib/i18n/locales.ts';
import { m } from '#lib/paraglide/messages.js';
import { normalize } from '#lib/search/normalize.ts';

export type VariationTitleParts = { dishName: string; variationName: string };

const WORD_CHARACTER = /[\p{L}\p{N}]/u;

// "Paella valenciana" already says Paella; "Paellas" or "Arroz con paella" don't.
function startsWithDishName({ dishName, variationName }: VariationTitleParts): boolean {
	const dish = normalize(dishName);
	const variation = normalize(variationName);
	if (!variation.startsWith(dish)) return false;
	const next = variation.charAt(dish.length);
	return next === '' || !WORD_CHARACTER.test(next);
}

// FE-9 D-FE9-6: outside its dish page a variation's title names the dish
// (region rows, the Recipe page), unless its own name already does.
export function variationTitle(parts: VariationTitleParts, locale: Locale): string {
	if (startsWithDishName(parts)) return parts.variationName;
	return m.variation_fullTitle(
		{ dish: parts.dishName, variation: parts.variationName },
		{ locale }
	);
}
