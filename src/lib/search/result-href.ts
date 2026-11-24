import { regionHref, variationRecipeHref, variationsHref } from '#lib/i18n/localized-href.ts';
import type { SearchEntry } from './search-index.ts';

export type SearchLayout = 'mobile' | 'desktop';

type ResultTarget = Pick<
	SearchEntry,
	'group' | 'dishKey' | 'regionKey' | 'variationSlug' | 'soleVariation'
>;

// Where a picked result goes (mobile README -> Overlay — Search; stage FE-7
// -> Desktop search): a dish opens its Variations page and a region its
// sheet or panel on both layouts; a variation opens its dish on mobile and
// its recipe on desktop. A dish with one variation has no Variations page,
// so its results open that recipe on both layouts (FE-11).
export function searchResultHref(entry: ResultTarget, lang: string, layout: SearchLayout): string {
	const { dishKey = '', regionKey = '', variationSlug = null } = entry;
	if (entry.group === 'region') return regionHref(regionKey, lang);
	if (entry.soleVariation) return variationRecipeHref(dishKey, entry.soleVariation, lang);
	if (entry.group === 'variation' && layout === 'desktop') {
		return variationRecipeHref(dishKey, { regionKey, variationSlug }, lang);
	}
	return variationsHref(dishKey, lang);
}
