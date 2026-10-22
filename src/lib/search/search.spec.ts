import { describe, expect, it } from 'vitest';
import type { Locale } from '#lib/i18n/locales.ts';
import { loadExport } from '../../testutil/load-export';
import {
	fixtureDish,
	fixtureRegion,
	groupRefs,
	refsIn,
	SEARCH_MODULE,
	searchCatalog,
	searchMock,
	show,
	type SearchCatalog,
	type SearchGroupKey
} from '../../testutil/search';

// FE-7 PR 1, search over the index (stage FE-7 -> Search logic -> search).
//
// Mobile README -> Overlay — Search: "case- and accent-insensitive substring
// match ... on title, subtitle and description text. Groups, in this order,
// max 6 each, empty groups hidden: Dishes, Variations (also matches on
// description, e.g. "onion"), Regions". Localization rules -> Search: the
// current language *and* the original Spanish names, so "paella" works in
// Russian. Stage: stable order within a group (catalog order); an empty
// query returns an empty result; whitespace is trimmed. D-FE7-1: й ≠ и.
//
// Decisions pinned here:
// - Module src/lib/search/search.ts exports search(index, query) and the
//   cap as MAX_RESULTS_PER_GROUP (6).
// - The result is an array of { group, entries }, only non-empty groups, in
//   the order dish, variation, region; entries are index entries.
// - Every entry also matches on its Spanish original (nameEs of the dish,
//   variation or region).
// - A dish also matches on its variations' names (local and Spanish), as in
//   the mobile prototype (dish `extra` = baseName + every variation name).
//   That is what makes "paella" find the paella dish in ru: its own names
//   are "Блюда из риса" / "Arroces"; only its variation "Paella valenciana"
//   says paella.
// - The query is trimmed only; inner spaces are part of the substring.

type Expected = Partial<Record<SearchGroupKey, string[]>>;

const MAX_PER_GROUP = 6;
const OVER_CAP = MAX_PER_GROUP + 2;

async function expectRefs(lang: Locale, query: string, want: Expected) {
	const groups = await searchMock(lang, query);
	for (const [group, refs] of Object.entries(want)) {
		const got = refsIn(groups, group as SearchGroupKey);
		expect(got, `${lang} ${show(query)} ${group}: got ${show(got)}, want ${show(refs)}`).toEqual(
			refs
		);
	}
}

async function expectContains(lang: Locale, query: string, group: SearchGroupKey, ref: string) {
	const got = refsIn(await searchMock(lang, query), group);
	expect(got, `${lang} ${show(query)} ${group}: got ${show(got)}, want ${ref}`).toContain(ref);
}

async function expectEmpty(lang: Locale, query: string) {
	const got = await searchMock(lang, query);
	expect(got, `${lang} ${show(query)}: got ${show(groupRefs(got))}, want []`).toEqual([]);
}

const numbered = (prefix: string) =>
	Array.from({ length: OVER_CAP }, (_, i) => ({ key: `${prefix}${i + 1}`, i: i + 1 }));

describe('search: matching (mock catalog)', () => {
	const EXACT: [string, Locale, string, Expected][] = [
		// [why, lang, query, want refs per group]
		[
			'"onion" finds the variations whose description mentions onion (stage case)',
			'en',
			'onion',
			{ variation: ['variation:tortilla/gal', 'variation:tortilla/val', 'variation:tortilla/mur'] }
		],
		[
			'descriptions match in Russian too',
			'ru',
			'лук',
			{ variation: ['variation:tortilla/gal', 'variation:tortilla/val', 'variation:tortilla/mur'] }
		],
		[
			'"андалусия" finds the region in ru (stage case)',
			'ru',
			'андалусия',
			{ region: ['region:and'] }
		],
		['upper case finds the region in ru', 'ru', 'АНДАЛУСИЯ', { region: ['region:and'] }],
		['"andalucia" finds Andalucía', 'en', 'andalucia', { region: ['region:and'] }],
		['an accented query finds the same', 'en', 'ANDALUCÍA', { region: ['region:and'] }],
		['a region matches on its Spanish name', 'en', 'pais vasco', { region: ['region:bas'] }],
		['a region matches on ñ folded', 'en', 'cataluna', { region: ['region:cat'] }],
		[
			'a region matches on its regional dishes (subtitle), accents folded',
			'en',
			'pulpo a feira',
			{ region: ['region:gal'] }
		],
		['a dish matches on its Spanish name', 'en', 'arroces', { dish: ['dish:paella'] }],
		[
			'a variation matches on its Spanish name',
			'en',
			'jugosa',
			{ variation: ['variation:tortilla/gal', 'variation:tortilla/val'] }
		],
		[
			'ё in the text matches е in the query',
			'ru',
			'печен',
			{ variation: ['variation:tortilla/bas', 'variation:tortilla/cat'] }
		],
		['й matches й', 'ru', 'пряный', { variation: ['variation:paella/bal'] }],
		['и does not match й (D-FE7-1)', 'ru', 'пряныи', { variation: [] }]
	];

	it.each(EXACT)('%s', async (_why, lang, query, want) => {
		await expectRefs(lang, query, want);
	});

	it('"paella" finds the paella dish and its variation in ru (stage case)', async () => {
		await expectContains('ru', 'paella', 'dish', 'dish:paella');
		await expectContains('ru', 'paella', 'variation', 'variation:paella/val');
	});

	it('returns index entries with their title and subtitle', async () => {
		const groups = await searchMock('en', 'betanzos');
		const group = groups.find((g) => g.group === 'variation');
		const want = {
			group: 'variation',
			title: 'Betanzos-style runny',
			subtitle: 'Galicia · Tortilla de patatas',
			dishKey: 'tortilla',
			regionKey: 'gal'
		};
		expect(group?.entries[0], `got ${show(group)}, want ${show(want)}`).toMatchObject(want);
	});
});

describe('search: empty and trimmed queries', () => {
	it.each(['', ' ', '   ', '\t\n '])('query %j returns an empty result', async (query) => {
		await expectEmpty('en', query);
	});

	it('a query that matches nothing returns an empty result', async () => {
		await expectEmpty('en', 'zzzz');
	});

	it('surrounding whitespace is trimmed', async () => {
		const [got, want] = await Promise.all([
			searchMock('en', '  onion \t'),
			searchMock('en', 'onion')
		]);
		expect(groupRefs(got), `got ${show(groupRefs(got))}`).toEqual(groupRefs(want));
		expect(groupRefs(got).length, 'trimmed query found nothing').toBeGreaterThan(0);
	});
});

describe('search: groups', () => {
	const empanada: SearchCatalog = {
		regions: [fixtureRegion({ key: 'gal', name: 'Galicia', regionalDishes: ['Empanada gallega'] })],
		dishes: [
			fixtureDish({
				key: 'empanada',
				name: 'Empanada',
				variations: [{ regionKey: 'gal', name: 'Empanada de zamburiñas' }]
			})
		]
	};

	it('orders groups Dishes → Variations → Regions', async () => {
		const got = groupRefs(await searchCatalog(empanada, 'en', 'empanada'));
		const want = [
			{ group: 'dish', refs: ['dish:empanada'] },
			{ group: 'variation', refs: ['variation:empanada/gal'] },
			{ group: 'region', refs: ['region:gal'] }
		];
		expect(got, `got ${show(got)}, want ${show(want)}`).toEqual(want);
	});

	it('hides empty groups', async () => {
		const got = groupRefs(await searchCatalog(empanada, 'en', 'zamburiñas'));
		const want = [
			{ group: 'dish', refs: ['dish:empanada'] },
			{ group: 'variation', refs: ['variation:empanada/gal'] }
		];
		expect(got, `got ${show(got)}, want ${show(want)}`).toEqual(want);
	});

	it('mock: "tortilla" caps variations at 6, in region order, and hides regions', async () => {
		const got = groupRefs(await searchMock('en', 'tortilla'));
		const regions = ['gal', 'ast', 'bas', 'cat', 'cyl', 'mad'];
		const want = [
			{ group: 'dish', refs: ['dish:tortilla'] },
			{ group: 'variation', refs: regions.map((key) => `variation:tortilla/${key}`) }
		];
		expect(got, `got ${show(got)}, want ${show(want)}`).toEqual(want);
	});
});

describe('search: cap and order within a group', () => {
	it('MAX_RESULTS_PER_GROUP is 6', async () => {
		const got = await loadExport<number>(SEARCH_MODULE, 'MAX_RESULTS_PER_GROUP');
		expect(got, `got ${got}, want ${MAX_PER_GROUP}`).toBe(MAX_PER_GROUP);
	});

	it('caps dishes at 6, keeping the first ones in catalog order', async () => {
		const dishes = numbered('sopa').map(({ key, i }) => fixtureDish({ key, name: `Sopa ${i}` }));
		const got = refsIn(await searchCatalog({ regions: [], dishes }, 'en', 'sopa'), 'dish');
		const want = dishes.slice(0, MAX_PER_GROUP).map((dish) => `dish:${dish.key}`);
		expect(got, `got ${show(got)}, want ${show(want)}`).toEqual(want);
	});

	it('caps regions at 6, keeping the first ones in catalog order', async () => {
		const regions = numbered('r').map(({ key, i }) =>
			fixtureRegion({ key, name: `Region ${i}`, regionalDishes: ['Migas'] })
		);
		const got = refsIn(await searchCatalog({ regions, dishes: [] }, 'en', 'migas'), 'region');
		const want = regions.slice(0, MAX_PER_GROUP).map((region) => `region:${region.key}`);
		expect(got, `got ${show(got)}, want ${show(want)}`).toEqual(want);
	});

	it('keeps catalog order, not match quality', async () => {
		const dishes = [
			fixtureDish({ key: 'sopa', name: 'Sopa de ajo' }),
			fixtureDish({ key: 'ajo', name: 'Ajo' })
		];
		const got = refsIn(await searchCatalog({ regions: [], dishes }, 'en', 'ajo'), 'dish');
		expect(got, `got ${show(got)}, want ["dish:sopa","dish:ajo"]`).toEqual([
			'dish:sopa',
			'dish:ajo'
		]);
	});

	it('a dish matches on the names of its variations (prototype)', async () => {
		const rice = fixtureDish({
			key: 'rice',
			name: 'Rice dishes',
			nameEs: 'Arroces',
			variations: [{ regionKey: 'val', name: 'Валенсийская', nameEs: 'Paella valenciana' }]
		});
		const got = refsIn(
			await searchCatalog({ regions: [], dishes: [rice] }, 'ru', 'paella'),
			'dish'
		);
		expect(got, `got ${show(got)}, want ["dish:rice"]`).toEqual(['dish:rice']);
	});
});
