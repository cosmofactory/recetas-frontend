import { describe, expect, it } from 'vitest';
import type { Locale } from '#lib/i18n/locales.ts';
import {
	fixtureDish,
	fixtureRegion,
	indexEntries,
	mockCatalog,
	show,
	type SearchEntry,
	type SearchGroupKey
} from '../../testutil/search';

// FE-7 PR 1, the search index (stage FE-7 -> Search logic -> buildIndex).
//
// Mobile README -> Overlay — Search: "Dishes — title = dish name, sub = "N
// variations"; Variations — title = variation name, sub = "Region · Dish";
// Regions — title = region name, sub = its regional dishes, thumbnail = its
// tile colour". Selecting: a dish or variation opens that dish, a region
// opens that region, so each entry carries the keys to route there.
//
// Decisions pinned here:
// - Module src/lib/search/search-index.ts exports
//   buildIndex(catalog: { regions, dishes }, locale) over the [lang=lang]
//   layout's lists; it returns the entries (an array; any extra fields, such
//   as a normalised haystack, are the module's business).
// - Entry: { group: 'dish' | 'variation' | 'region', title, subtitle } plus
//   dish -> dishKey; variation -> dishKey + regionKey; region -> regionKey +
//   tileColor (null stays null: the overlay draws the placeholder).
// - "N variations" is the existing plural message (m.home_variation, as on
//   DishCard) in the given locale; "Region · Dish" joins with DOT_SEPARATOR.
// - A region's subtitle is its regionalDishes joined with ", " (the mobile
//   prototype's `r.dishes.map(x => x[0]).join(', ')`; the README only says
//   "its regional dishes").
// - Within a group, entries keep catalog order: dishes in list order, each
//   dish's variations in its (region) order, regions in list order.

const entriesOf = (entries: SearchEntry[], group: SearchGroupKey) =>
	entries.filter((entry) => entry.group === group);

async function mockEntries(lang: Locale, group: SearchGroupKey) {
	return entriesOf(await indexEntries(mockCatalog(lang), lang), group);
}

function findEntry(entries: SearchEntry[], match: Partial<SearchEntry>): SearchEntry {
	const found = entries.find((entry) =>
		Object.entries(match).every(([key, value]) => entry[key as keyof SearchEntry] === value)
	);
	expect(found, `no entry ${show(match)} in ${show(entries.map((e) => e.title))}`).toBeDefined();
	return found as SearchEntry;
}

function expectEntry(got: SearchEntry, want: SearchEntry) {
	expect(got, `got ${show(got)}, want ${show(want)}`).toMatchObject(want);
}

describe('buildIndex: dishes', () => {
	const DISH_CASES: [Locale, SearchEntry][] = [
		[
			'en',
			{
				group: 'dish',
				title: 'Tortilla de patatas',
				subtitle: '13 variations',
				dishKey: 'tortilla'
			}
		],
		['es', { group: 'dish', title: 'Arroces', subtitle: '7 variantes', dishKey: 'paella' }],
		['ru', { group: 'dish', title: 'Блюда из риса', subtitle: '7 вариантов', dishKey: 'paella' }],
		['ru', { group: 'dish', title: 'Тортилья', subtitle: '13 вариантов', dishKey: 'tortilla' }]
	];

	it.each(DISH_CASES)('%s: %o', async (lang, want) => {
		const dishes = await mockEntries(lang, 'dish');
		expectEntry(findEntry(dishes, { dishKey: want.dishKey }), want);
	});

	it('one entry per dish, in catalog order', async () => {
		const got = (await mockEntries('en', 'dish')).map((entry) => entry.dishKey);
		const want = mockCatalog('en').dishes.map((dish) => dish.key);
		expect(got, `got ${show(got)}, want ${show(want)}`).toEqual(want);
	});

	it('uses the singular for a dish with one variation', async () => {
		const dish = fixtureDish({
			key: 'filloas',
			name: 'Filloas',
			variations: [{ regionKey: 'gal', name: 'Filloas de sangre' }]
		});
		const [entry] = entriesOf(await indexEntries({ regions: [], dishes: [dish] }, 'en'), 'dish');
		expectEntry(entry, { group: 'dish', title: 'Filloas', subtitle: '1 variation' });
	});
});

describe('buildIndex: variations', () => {
	const VARIATION_CASES: [Locale, SearchEntry][] = [
		[
			'en',
			{
				group: 'variation',
				title: 'Betanzos-style runny',
				subtitle: 'Galicia · Tortilla de patatas',
				dishKey: 'tortilla',
				regionKey: 'gal'
			}
		],
		[
			'es',
			{
				group: 'variation',
				title: 'Paella valenciana',
				subtitle: 'Comunidad Valenciana · Arroces',
				dishKey: 'paella',
				regionKey: 'val'
			}
		],
		[
			'ru',
			{
				group: 'variation',
				title: 'По-бетансосски, жидкая внутри',
				subtitle: 'Галисия · Тортилья',
				dishKey: 'tortilla',
				regionKey: 'gal'
			}
		]
	];

	it.each(VARIATION_CASES)('%s: %o', async (lang, want) => {
		const variations = await mockEntries(lang, 'variation');
		const match = { dishKey: want.dishKey, regionKey: want.regionKey };
		expectEntry(findEntry(variations, match), want);
	});

	it('one entry per variation, dish by dish in catalog order, each in region order', async () => {
		const got = (await mockEntries('en', 'variation')).map((e) => `${e.dishKey}/${e.regionKey}`);
		const want = mockCatalog('en').dishes.flatMap((dish) =>
			dish.variations.map((variation) => `${dish.key}/${variation.regionKey}`)
		);
		expect(got, `got ${show(got)}, want ${show(want)}`).toEqual(want);
	});
});

describe('buildIndex: regions', () => {
	const REGION_CASES: [Locale, SearchEntry][] = [
		[
			'en',
			{
				group: 'region',
				title: 'Galicia',
				subtitle: 'Pulpo á feira, Empanada gallega, Lacón con grelos',
				regionKey: 'gal',
				tileColor: '#9A9A5E'
			}
		],
		[
			'ru',
			{
				group: 'region',
				title: 'Андалусия',
				subtitle: 'Gazpacho andaluz, Salmorejo cordobés, Pescaíto frito',
				regionKey: 'and',
				tileColor: '#C4552E'
			}
		]
	];

	it.each(REGION_CASES)('%s: %o', async (lang, want) => {
		const regions = await mockEntries(lang, 'region');
		expectEntry(findEntry(regions, { regionKey: want.regionKey }), want);
	});

	it('one entry per region, in catalog order', async () => {
		const got = (await mockEntries('en', 'region')).map((entry) => entry.regionKey);
		const want = mockCatalog('en').regions.map((region) => region.key);
		expect(got, `got ${show(got)}, want ${show(want)}`).toEqual(want);
	});

	it('keeps a missing tile colour as null', async () => {
		const region = fixtureRegion({ key: 'gal', name: 'Galicia', tileColor: null });
		const [entry] = entriesOf(
			await indexEntries({ regions: [region], dishes: [] }, 'en'),
			'region'
		);
		expectEntry(entry, { group: 'region', title: 'Galicia', subtitle: '', tileColor: null });
	});
});
