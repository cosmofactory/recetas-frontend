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

const CASES: { what: string; origin: BackOrigin | null; want: BackPillLink }[] = [
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
	{
		what: 'the bare Regional home reads Regional (the home tab, prototype L860)',
		origin: { href: '/en/', from: 'home', tab: 'regional' },
		want: { label: 'Regional', href: '/en/' }
	}
];

describe('recipeBackPill names the page its href goes to', () => {
	for (const { what, origin, want } of CASES) {
		it(what, async () => {
			const recipeBackPill = await loadRecipeBackPill();
			const got = recipeBackPill(origin, BETANZOS, 'en', CATALOG);
			expect(got, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`).toEqual(want);
		});
	}
});
