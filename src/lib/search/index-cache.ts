import type { Locale } from '#lib/i18n/locales.ts';
import { buildIndex, type SearchCatalog, type SearchEntry } from './search-index.ts';

type Cached = SearchCatalog & { locale: Locale; index: SearchEntry[] };

// buildIndex memoised on its inputs: the same catalog lists in the same
// locale reuse the last index, so the screen can ask for it freely.
export function cachedIndexBuilder(): (catalog: SearchCatalog, locale: Locale) => SearchEntry[] {
	let last: Cached | undefined;
	return (catalog, locale) => {
		const fresh =
			last?.locale === locale && last.regions === catalog.regions && last.dishes === catalog.dishes;
		if (fresh && last) return last.index;
		last = { ...catalog, locale, index: buildIndex(catalog, locale) };
		return last.index;
	};
}
