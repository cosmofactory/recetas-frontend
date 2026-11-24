import { describe, expect, it } from 'vitest';
import { loadExport } from '../../testutil/load-export';

// FE-5 card hrefs (card-href.ts): mobile opens the dish sheet over the same
// filtered list, desktop the Variations page.
//
// FE-11 (both READMEs -> "Spanish (Spain-wide) variations"): a dish with
// exactly one variation in total has no Variations page, and "its Popular
// card ... open[s] the recipe", on both layouts (no dish sheet on mobile:
// it would list one row). Contract assumed: dishCardHref(url, dish, layout)
// takes the dish ({ key, variations }) instead of its key, since the link
// depends on its variations.

type Layout = 'mobile' | 'desktop';
type VariationTarget = { regionKey: string; variationSlug: string | null };
type CardDish = { key: string; variations: VariationTarget[] };
type DishCardHref = (url: URL, dish: CardDish, layout: Layout) => string;

const ORIGIN = 'https://asadorov.test';
const url = (pathAndQuery: string) => new URL(pathAndQuery, ORIGIN);

const loadHref = () => loadExport<DishCardHref>('src/lib/popular/card-href.ts', 'dishCardHref');

const regional = (regionKey: string): VariationTarget => ({ regionKey, variationSlug: null });
const spanish = (variationSlug: string): VariationTarget => ({ regionKey: 'esp', variationSlug });

const GAZPACHO: CardDish = { key: 'gazpacho', variations: [regional('and'), regional('ext')] };
const TORTILLA: CardDish = { key: 'tortilla', variations: [regional('gal'), regional('ast')] };
const PAELLA: CardDish = { key: 'paella', variations: [regional('cat'), regional('val')] };
const ALLIOLI: CardDish = {
	key: 'allioli',
	variations: [spanish('allioli-de-morter'), spanish('allioli-de-codony')]
};
const ARROZ_BLANCO: CardDish = {
	key: 'arrozblanco',
	variations: [spanish('arroz-blanco-con-tomate')]
};
const ONE_REGIONAL: CardDish = { key: 'tortilla', variations: [regional('gal')] };

type Case = { why: string; from: string; dish: CardDish; layout: Layout; want: string };

const CASES: Case[] = [
	{
		why: 'mobile: the dish sheet URL, keeping the filters in canonical order',
		from: '/es/?tab=popular&f=summer&f=vegetarian',
		dish: GAZPACHO,
		layout: 'mobile',
		want: '/es/?tab=popular&f=vegetarian&f=summer&dish=gazpacho'
	},
	{
		why: 'mobile: drops any other param, including an open dish',
		from: '/en/?tab=popular&dish=paella&utm=x',
		dish: TORTILLA,
		layout: 'mobile',
		want: '/en/?tab=popular&dish=tortilla'
	},
	{
		why: 'desktop: the Variations page in the URL locale, without the filters',
		from: '/ru/?tab=popular&f=pork&dish=cocido',
		dish: PAELLA,
		layout: 'desktop',
		want: '/ru/dishes/paella'
	},
	// FE-11.
	{
		why: 'mobile: two Spanish variations still open the dish sheet',
		from: '/en/?tab=popular&f=basics',
		dish: ALLIOLI,
		layout: 'mobile',
		want: '/en/?tab=popular&f=basics&dish=allioli'
	},
	{
		why: 'desktop: two Spanish variations open the Variations page',
		from: '/en/?tab=popular',
		dish: ALLIOLI,
		layout: 'desktop',
		want: '/en/dishes/allioli'
	},
	{
		why: 'mobile: one variation in total opens its recipe, no dish sheet',
		from: '/es/?tab=popular&f=mains',
		dish: ARROZ_BLANCO,
		layout: 'mobile',
		want: '/es/dishes/arrozblanco/esp/arroz-blanco-con-tomate'
	},
	{
		why: 'desktop: one variation in total opens its recipe',
		from: '/ru/?tab=popular',
		dish: ARROZ_BLANCO,
		layout: 'desktop',
		want: '/ru/dishes/arrozblanco/esp/arroz-blanco-con-tomate'
	},
	{
		why: 'one regional variation opens its regional recipe',
		from: '/en/?tab=popular',
		dish: ONE_REGIONAL,
		layout: 'mobile',
		want: '/en/dishes/tortilla/gal'
	}
];

describe('dishCardHref', () => {
	for (const tc of CASES) {
		it(tc.why, async () => {
			const dishCardHref = await loadHref();
			const got = dishCardHref(url(tc.from), tc.dish, tc.layout);
			expect(got, `got ${got}, want ${tc.want}`).toBe(tc.want);
		});
	}
});
