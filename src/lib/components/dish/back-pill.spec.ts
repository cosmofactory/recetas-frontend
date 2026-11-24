import { describe, expect, it } from 'vitest';
import type { BackOrigin } from '#lib/ui/back-origin.ts';
import { loadExport } from '../../../testutil/load-export';

// The desktop Recipe back pill (FE-6 PR 4, back-pill.ts), and the FE-7 PR 4
// rule for a search pick: the pill's label always names the page its href
// goes to (coordinator decision, FE-7 PR 4). Before search, a recipe was
// only reached from its own dish's Variations page or its own region, so
// the recipe's names were enough; a search pick can open a recipe of
// another dish or region, so the label comes from the origin page.
//
// Contract the new cases assume: recipeBackPill takes a 4th argument, the
// [lang=lang] layout's lists (`{ dishes, regions }`, each entry with `key`
// and `name`), and names a Variations origin by its dish and a region
// origin by its region, both read from the origin's URL. Loaded at run
// time, so the extra argument isn't a type error before it exists.

type RecipeNames = { dishKey: string; dishName: string; regionName: string };
type Named = { key: string; name: string };
type OriginCatalog = { dishes: Named[]; regions: Named[] };
type BackPillLink = { label: string; href: string };
type RecipeBackPill = (
	origin: BackOrigin | null,
	recipe: RecipeNames,
	lang: string,
	catalog: OriginCatalog
) => BackPillLink;

const loadRecipeBackPill = () =>
	loadExport<RecipeBackPill>('src/lib/components/dish/back-pill.ts', 'recipeBackPill');

// The Betanzos-style tortilla recipe (tortilla/gal), in en.
const BETANZOS: RecipeNames = {
	dishKey: 'tortilla',
	dishName: 'Tortilla de patatas',
	regionName: 'Galicia'
};

const CATALOG: OriginCatalog = {
	dishes: [
		{ key: 'tortilla', name: 'Tortilla de patatas' },
		{ key: 'paella', name: 'Rice dishes' }
	],
	regions: [
		{ key: 'gal', name: 'Galicia' },
		{ key: 'and', name: 'Andalucía' }
	]
};

type Case = {
	what: string;
	origin: BackOrigin | null;
	want: BackPillLink;
	catalog?: OriginCatalog;
};

const CASES: Case[] = [
	// Guards: what FE-6 already does, and must keep doing.
	{
		what: 'a direct load names the dish and links its Variations page',
		origin: null,
		want: { label: 'Tortilla de patatas', href: '/en/dishes/tortilla' }
	},
	{
		what: "the recipe's own Variations page names its dish",
		origin: { href: '/en/dishes/tortilla', from: 'variations', tab: 'popular' },
		want: { label: 'Tortilla de patatas', href: '/en/dishes/tortilla' }
	},
	{
		what: 'Popular reads Popular',
		origin: { href: '/en/?tab=popular&f=tapas', from: 'home', tab: 'popular' },
		want: { label: 'Popular', href: '/en/?tab=popular&f=tapas' }
	},
	{
		what: "the recipe's own region names that region",
		origin: { href: '/en/regions/gal', from: 'home', tab: 'regional' },
		want: { label: 'Galicia', href: '/en/regions/gal' }
	},
	// New (FE-7 PR 4): a search pick from another dish or region.
	{
		what: "another dish's Variations page names that dish",
		origin: { href: '/en/dishes/paella', from: 'variations', tab: 'popular' },
		want: { label: 'Rice dishes', href: '/en/dishes/paella' }
	},
	{
		what: 'another region names the origin region, not the recipe’s',
		origin: { href: '/en/regions/and', from: 'home', tab: 'regional' },
		want: { label: 'Andalucía', href: '/en/regions/and' }
	},
	// FE-9 FB-13 (D-FE9-8): the desktop home opens with no region, so the
	// bare Regional home names no region; like Popular, it reads its tab.
	{
		what: 'the bare Regional home reads Regional, not a default region (D-FE9-8)',
		origin: { href: '/en/', from: 'home', tab: 'regional' },
		want: { label: 'Regional', href: '/en/' }
	},
	{
		what: 'the bare Regional home reads Regional with no regions in the catalog',
		origin: { href: '/en/', from: 'home', tab: 'regional' },
		want: { label: 'Regional', href: '/en/' },
		catalog: { dishes: CATALOG.dishes, regions: [] }
	}
];

describe('recipeBackPill names the page its href goes to', () => {
	for (const { what, origin, want, catalog = CATALOG } of CASES) {
		it(what, async () => {
			const recipeBackPill = await loadRecipeBackPill();
			const got = recipeBackPill(origin, BETANZOS, 'en', catalog);
			expect(got, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`).toEqual(want);
		});
	}
});

// FE-11 (both READMEs -> "Spanish (Spain-wide) variations"): a dish with
// exactly one variation in total has no Variations page (it 301s to the
// recipe), so on a direct load "the recipe's back pill returns to Popular":
// "‹ Popular" to /:lang/?tab=popular. Contract assumed: the layout's
// `dishes` list given as the catalog carries each dish's `variations`
// (it is the full Dish list), which tells a one-variation dish.
type Variation = { regionKey: string; variationSlug: string | null };
type DishEntry = Named & { variations: Variation[] };

const ARROZ_BLANCO_RECIPE: RecipeNames = {
	dishKey: 'arrozblanco',
	dishName: 'Arroz blanco con tomate',
	regionName: 'Spanish'
};
const ALLIOLI_RECIPE: RecipeNames = {
	dishKey: 'allioli',
	dishName: 'Allioli',
	regionName: 'Spanish'
};

const SPANISH_DISHES: DishEntry[] = [
	{
		key: 'arrozblanco',
		name: 'Arroz blanco con tomate',
		variations: [{ regionKey: 'esp', variationSlug: 'arroz-blanco-con-tomate' }]
	},
	{
		key: 'allioli',
		name: 'Allioli',
		variations: [
			{ regionKey: 'esp', variationSlug: 'allioli-de-morter' },
			{ regionKey: 'esp', variationSlug: 'allioli-de-codony' }
		]
	}
];
const SPANISH_CATALOG = { dishes: SPANISH_DISHES, regions: CATALOG.regions };

type SpanishCase = { what: string; recipe: RecipeNames; lang: string; want: BackPillLink };

const SPANISH_CASES: SpanishCase[] = [
	{
		what: 'a one-variation dish on a direct load reads Popular, to Popular',
		recipe: ARROZ_BLANCO_RECIPE,
		lang: 'en',
		want: { label: 'Popular', href: '/en/?tab=popular' }
	},
	{
		what: 'a one-variation dish on a direct load keeps the page language (es)',
		recipe: ARROZ_BLANCO_RECIPE,
		lang: 'es',
		want: { label: 'Popular', href: '/es/?tab=popular' }
	},
	{
		what: 'a two-variation Spanish dish on a direct load names the dish',
		recipe: ALLIOLI_RECIPE,
		lang: 'en',
		want: { label: 'Allioli', href: '/en/dishes/allioli' }
	}
];

describe('recipeBackPill for a dish with one variation (FE-11)', () => {
	for (const { what, recipe, lang, want } of SPANISH_CASES) {
		it(what, async () => {
			const recipeBackPill = await loadRecipeBackPill();
			const got = recipeBackPill(null, recipe, lang, SPANISH_CATALOG);
			expect(got, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`).toEqual(want);
		});
	}

	it('from Popular it still goes back to that Popular URL', async () => {
		const recipeBackPill = await loadRecipeBackPill();
		const origin: BackOrigin = { href: '/en/?tab=popular&f=mains', from: 'home', tab: 'popular' };
		const got = recipeBackPill(origin, ARROZ_BLANCO_RECIPE, 'en', SPANISH_CATALOG);
		expect(got).toEqual({ label: 'Popular', href: '/en/?tab=popular&f=mains' });
	});
});
