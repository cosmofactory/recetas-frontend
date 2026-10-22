import { localizedHref, recipeHref, variationsHref } from '#lib/i18n/localized-href.ts';
import type { SearchEntry } from './search-index.ts';

export type SearchLayout = 'mobile' | 'desktop';

type ResultTarget = Pick<SearchEntry, 'group' | 'dishKey' | 'regionKey'>;

// Where a picked result goes (mobile README -> Overlay — Search; stage FE-7
// -> Desktop search): a dish opens its Variations page and a region its
// sheet or panel on both layouts; a variation opens its dish on mobile and
// its recipe on desktop.
export function searchResultHref(entry: ResultTarget, lang: string, layout: SearchLayout): string {
	const { dishKey = '', regionKey = '' } = entry;
	if (entry.group === 'region') return localizedHref(`/regions/${regionKey}`, lang);
	if (entry.group === 'variation' && layout === 'desktop') {
		return recipeHref(dishKey, regionKey, lang);
	}
	return variationsHref(dishKey, lang);
}
