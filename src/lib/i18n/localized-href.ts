import type { Locale } from './locales.ts';

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
