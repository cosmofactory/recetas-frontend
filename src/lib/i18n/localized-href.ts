import type { Locale } from './locales.ts';

// Prefixes a locale-free app path ("/dishes/tortilla", "/?tab=popular") with
// the locale. Every internal link goes through this (pnpm check:strings).
export function localizedHref(path: string, lang: Locale | string): string {
	return `/${lang}${path}`;
}
