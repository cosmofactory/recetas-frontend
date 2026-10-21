import { describe, expect, it } from 'vitest';
import type { Dish } from '#lib/server/catalog-source.ts';
import { buildView } from '#lib/server/mock/bundle-mapping.ts';
import bundle from '#lib/server/mock/content.bundle.json';
import { loadExport } from '../../testutil/load-export';

// FE-4 PR 3, the region sheet's dish list as a pure function.
// Mobile README -> Regional tab — Region sheet L77: "a dish list: this
// region's variation of each popular dish (from dishes[].variations where
// regionKey matches)"; L169 "Region sheet count shows the region's number
// of variations". Stage FE-4 -> Region sheet: "one row per variation that
// has regionKey = this region". The API's RegionDetail documents the same
// list "in dish order (Dish.order)" (src/lib/api/openapi.yaml), and the
// (home) layout builds it from the [lang=lang] layout's `dishes` list.
//
// Decisions pinned here:
// - Module: src/lib/content/region-variations.ts, export
//   `regionVariations(regionKey, dishes)`.
// - Each row is the dish's VariationSummary plus its `dishKey` (the recipe
//   URL is /:lang/dishes/:dishKey/:regionKey): `{ dishKey, ...variation }`.
// - Order is `Dish.order`, whatever order the list arrives in.
// - The input is not mutated (the layout's list is shared by every screen).

type Row = Dish['variations'][number] & { dishKey: string };
type RegionVariations = (regionKey: string, dishes: Dish[]) => Row[];

const MODULE = 'src/lib/content/region-variations.ts';

const load = () => loadExport<RegionVariations>(MODULE, 'regionVariations');

const dishesIn = (lang: 'en' | 'es' | 'ru') => buildView(bundle, lang).dishes;

function rowFor(dish: Dish, regionKey: string): Row {
	const variation = dish.variations.find((v) => v.regionKey === regionKey);
	if (!variation) throw new Error(`fixture dish ${dish.key} has no ${regionKey} variation`);
	return { dishKey: dish.key, ...variation };
}

const dishByKey = (dishes: Dish[], key: string) => {
	const dish = dishes.find((d) => d.key === key);
	if (!dish) throw new Error(`fixture has no dish ${key}`);
	return dish;
};

describe('regionVariations: one row per dish cooked in the region', () => {
	// The vendored bundle (content.design.json): which dishes have a
	// variation in each region, in dish order.
	const cases: { regionKey: string; dishKeys: string[] }[] = [
		{ regionKey: 'gal', dishKeys: ['tortilla', 'cocido', 'croquetas', 'torrijas'] },
		{
			regionKey: 'and',
			dishKeys: ['tortilla', 'paella', 'cocido', 'gazpacho', 'croquetas', 'torrijas']
		},
		{ regionKey: 'bas', dishKeys: ['tortilla', 'croquetas', 'arrozleche'] },
		{ regionKey: 'ext', dishKeys: ['tortilla', 'cocido', 'gazpacho'] },
		{ regionKey: 'can', dishKeys: ['paella', 'cocido', 'croquetas', 'torrijas'] },
		{ regionKey: 'cyl', dishKeys: ['tortilla', 'croquetas', 'torrijas', 'arrozleche'] }
	];
	for (const tc of cases) {
		it(`${tc.regionKey}: ${tc.dishKeys.join(', ')}`, async () => {
			const regionVariations = await load();
			const got = regionVariations(tc.regionKey, dishesIn('en')).map((row) => row.dishKey);
			expect(got, `got ${JSON.stringify(got)}, want ${JSON.stringify(tc.dishKeys)}`).toEqual(
				tc.dishKeys
			);
		});
	}

	it("every row is that dish's variation for the region, plus its dishKey", async () => {
		const regionVariations = await load();
		const dishes = dishesIn('en');
		const want = ['tortilla', 'cocido', 'croquetas', 'torrijas'].map((key) =>
			rowFor(dishByKey(dishes, key), 'gal')
		);
		expect(regionVariations('gal', dishes)).toEqual(want);
	});

	it('keeps the localized names and descriptions (ru)', async () => {
		const regionVariations = await load();
		const [first] = regionVariations('gal', dishesIn('ru'));
		expect(first?.name, `got ${first?.name}`).toBe('По-бетансосски, жидкая внутри');
		expect(first?.description, `got ${first?.description}`).toBe(
			'Едва схваченная серединка, без лука, едят с хлебом'
		);
	});

	it('only ever returns rows of the requested region', async () => {
		const regionVariations = await load();
		for (const regionKey of ['gal', 'and', 'bal', 'mur']) {
			const keys = regionVariations(regionKey, dishesIn('en')).map((row) => row.regionKey);
			expect(new Set(keys), `got region keys ${JSON.stringify(keys)}`).toEqual(
				new Set([regionKey])
			);
		}
	});
});

describe('regionVariations: order and edge cases', () => {
	it('orders rows by Dish.order, not by list position', async () => {
		const regionVariations = await load();
		const shuffled = [...dishesIn('en')].reverse();
		const got = regionVariations('gal', shuffled).map((row) => row.dishKey);
		expect(got, `got ${JSON.stringify(got)}`).toEqual([
			'tortilla',
			'cocido',
			'croquetas',
			'torrijas'
		]);
	});

	it('follows a changed editorial order', async () => {
		const regionVariations = await load();
		const dishes = dishesIn('en').map((dish) =>
			dish.key === 'torrijas' ? { ...dish, order: 0 } : dish
		);
		const got = regionVariations('gal', dishes).map((row) => row.dishKey);
		expect(got[0], `got ${JSON.stringify(got)}, want torrijas first (order 0)`).toBe('torrijas');
	});

	it('returns no rows for a region no dish is cooked in', async () => {
		const regionVariations = await load();
		expect(regionVariations('nowhere', dishesIn('en'))).toEqual([]);
	});

	it('returns no rows for an empty dish list', async () => {
		const regionVariations = await load();
		expect(regionVariations('gal', [])).toEqual([]);
	});

	it('does not reorder or change the list it is given', async () => {
		const regionVariations = await load();
		const dishes = [...dishesIn('en')].reverse();
		const before = JSON.stringify(dishes);
		regionVariations('gal', dishes);
		expect(JSON.stringify(dishes), 'got the input list mutated').toBe(before);
	});
});
