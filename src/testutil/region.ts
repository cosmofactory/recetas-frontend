import type { Dish } from '#lib/server/catalog-source.ts';
import { localizedHref } from '#lib/i18n/localized-href.ts';
import { buildView } from '#lib/server/mock/bundle-mapping.ts';
import bundle from '#lib/server/mock/content.bundle.json';
import type { Lang, Region } from './map';

// FE-4 PR 3 fixtures for RegionDetails (the region sheet / panel content):
// the regions and dishes exactly as the [lang=lang] layout hands them on,
// from the vendored mock bundle. Shared by the Node and the browser specs,
// so no node: imports here.

export type { Dish };

// What RegionDetails takes (decided in FE-4 PR 3): data and callbacks only.
// recipeHref(dishKey, regionKey) is the row's link; mediaBaseUrl is what
// <Photo> builds the thumb URLs against.
export type RegionDetailsProps = {
	region: Region;
	dishes: Dish[];
	recipeHref: (dishKey: string, regionKey: string) => string;
	mediaBaseUrl: string | undefined;
};

export const REGION_DETAILS_TEST_ID = 'region-details';

export function dishesIn(lang: Lang): Dish[] {
	return buildView(bundle, lang).dishes;
}

export function regionIn(lang: Lang, key: string): Region {
	const region = buildView(bundle, lang).regions.find((r) => r.key === key);
	if (!region) throw new Error(`fixture has no region ${key}`);
	return region;
}

export function recipeHrefIn(lang: Lang): RegionDetailsProps['recipeHref'] {
	return (dishKey, regionKey) => localizedHref(`/dishes/${dishKey}/${regionKey}`, lang);
}

// `count` dishes that each have one variation in `regionKey`, in dish
// order: a region with exactly that many variations (for the plural).
export function dishesCookedIn(regionKey: string, count: number, lang: Lang = 'en'): Dish[] {
	const [template] = dishesIn(lang);
	const variation = { ...template.variations[0], regionKey };
	return Array.from({ length: count }, (_, i) => ({
		...template,
		key: `dish-${i + 1}`,
		order: i + 1,
		variations: [{ ...variation, recipeKey: `dish-${i + 1}-${regionKey}` }]
	}));
}
