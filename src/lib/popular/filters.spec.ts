import { describe, expect, it } from 'vitest';
import type { Dish } from '#lib/server/catalog-source.ts';
import { buildView } from '#lib/server/mock/bundle-mapping.ts';
import bundle from '#lib/server/mock/content.bundle.json';
import { loadExport } from '../../testutil/load-export';

// FE-5 PR 1, the Popular tab's filter logic as pure functions (stage FE-5 ->
// Filter logic; X1: filtering runs in the browser over the catalog).
//
// Sources:
// - Mobile README -> Filters sheet L105–110: "Four groups ... Diet:
//   Vegetarian, Seafood, With pork; Course: Tapas, Mains, Desserts; Effort:
//   Quick, Slow-cooked; Season: Summer, Winter, Holy Week, All year. Logic:
//   OR within a group, AND across groups."
// - Mobile prototype (Asadorov Explorations.dc.html) L1090–1102, the owner's
//   tie-breaker: GROUPS = diet [veg, seafood, pork], course [tapas, mains,
//   desserts], effort [quick, slow], season [summer, winter, Holy Week =
//   season 'easter', All year = season 'all'], and applyFilt keeps a dish
//   when every group has nothing picked or one picked test passes. The
//   README and the prototype agree on the groups, their order and the
//   tests; nothing to adjust.
// - D-FE5-1 (owner, 2026-10-21): locale-independent ASCII ids; repeated `f`
//   params; unknown ids dropped silently; a stable serialized order.
//
// Decisions pinned here (FE-5 PR 1):
// - Module src/lib/popular/filters.ts exports FILTER_GROUPS
//   ({ key, ids }[]), FILTER_IDS (the flat canonical order), QUICK_FILTER_IDS
//   and filterDishes(dishes, activeIds).
// - The canonical order of ids is the group order, then the order inside the
//   group (the list below); every serialized URL uses it.
// - "All year" (all-year) matches `season: 'all'` only: it is one of four
//   exclusive season values in the data model, as in the prototype; it does
//   not mean "any season".
// - filterDishes keeps the input order and never mutates the list; an id it
//   doesn't know is ignored (parseFilters has already dropped those).

type FilterGroup = { key: string; ids: readonly string[] };
type FilterDishes = (dishes: readonly Dish[], activeIds: readonly string[]) => Dish[];

const MODULE = 'src/lib/popular/filters.ts';

const WANT_GROUPS: FilterGroup[] = [
	{ key: 'diet', ids: ['vegetarian', 'seafood', 'pork'] },
	{ key: 'course', ids: ['tapas', 'mains', 'desserts'] },
	{ key: 'effort', ids: ['quick', 'slow-cooked'] },
	{ key: 'season', ids: ['summer', 'winter', 'easter', 'all-year'] }
];
const ALL_IDS = WANT_GROUPS.flatMap((group) => group.ids);
const ALL_DISH_KEYS = [
	'tortilla',
	'paella',
	'cocido',
	'gazpacho',
	'croquetas',
	'torrijas',
	'arrozleche'
];

const loadFilterDishes = () => loadExport<FilterDishes>(MODULE, 'filterDishes');

const dishesIn = (lang: 'en' | 'es' | 'ru') => buildView(bundle, lang).dishes;
const keysOf = (dishes: readonly Dish[]) => dishes.map((dish) => dish.key);
const show = (value: unknown) => JSON.stringify(value);

async function expectKeys(activeIds: string[], want: string[], dishes = dishesIn('en')) {
	const filterDishes = await loadFilterDishes();
	const got = keysOf(filterDishes(dishes, activeIds));
	expect(got, `filter ${show(activeIds)}: got ${show(got)}, want ${show(want)}`).toEqual(want);
}

describe('filter ids and groups', () => {
	it('four groups in README order: diet, course, effort, season, with their ids', async () => {
		const groups = await loadExport<FilterGroup[]>(MODULE, 'FILTER_GROUPS');
		const got = groups.map((group) => ({ key: group.key, ids: [...group.ids] }));
		expect(got, `got ${show(got)}`).toEqual(WANT_GROUPS);
	});

	it('FILTER_IDS is every id once, in the canonical group order', async () => {
		const ids = await loadExport<readonly string[]>(MODULE, 'FILTER_IDS');
		expect([...ids], `got ${show(ids)}, want ${show(ALL_IDS)}`).toEqual(ALL_IDS);
	});

	it('the quick chips are vegetarian, quick, desserts, summer (README filter bar)', async () => {
		const quick = await loadExport<readonly string[]>(MODULE, 'QUICK_FILTER_IDS');
		const want = ['vegetarian', 'quick', 'desserts', 'summer'];
		expect([...quick], `got ${show(quick)}, want ${show(want)}`).toEqual(want);
	});
});

// The vendored bundle (content.design.json), dish order:
//   tortilla   vegetarian, quick, tapas, all
//   paella     seafood, slow-cooked, mains, all
//   cocido     pork, slow-cooked, mains, winter
//   gazpacho   vegetarian, quick, tapas, summer
//   croquetas  pork, quick, tapas, all
//   torrijas   (no diet flag), quick, desserts, easter
//   arrozleche vegetarian, slow-cooked, desserts, all
type Case = { name: string; ids: string[]; want: string[] };

const SINGLE_FILTER: Case[] = [
	{
		name: 'vegetarian → flags.vegetarian',
		ids: ['vegetarian'],
		want: ['tortilla', 'gazpacho', 'arrozleche']
	},
	{ name: 'seafood → flags.seafood', ids: ['seafood'], want: ['paella'] },
	{ name: 'pork ("With pork") → flags.pork', ids: ['pork'], want: ['cocido', 'croquetas'] },
	{ name: 'tapas → course tapas', ids: ['tapas'], want: ['tortilla', 'gazpacho', 'croquetas'] },
	{ name: 'mains → course mains', ids: ['mains'], want: ['paella', 'cocido'] },
	{ name: 'desserts → course desserts', ids: ['desserts'], want: ['torrijas', 'arrozleche'] },
	{
		name: 'quick → flags.quick',
		ids: ['quick'],
		want: ['tortilla', 'gazpacho', 'croquetas', 'torrijas']
	},
	{
		name: 'slow-cooked → flags.slowCooked',
		ids: ['slow-cooked'],
		want: ['paella', 'cocido', 'arrozleche']
	},
	{ name: 'summer → season summer', ids: ['summer'], want: ['gazpacho'] },
	{ name: 'winter → season winter', ids: ['winter'], want: ['cocido'] },
	{ name: 'easter ("Holy Week") → season easter', ids: ['easter'], want: ['torrijas'] },
	{
		name: "all-year matches season 'all' only, not every season",
		ids: ['all-year'],
		want: ['tortilla', 'paella', 'croquetas', 'arrozleche']
	}
];

const SAME_GROUP: Case[] = [
	{
		name: 'diet: vegetarian OR seafood',
		ids: ['vegetarian', 'seafood'],
		want: ['tortilla', 'paella', 'gazpacho', 'arrozleche']
	},
	{
		name: 'diet: seafood OR pork',
		ids: ['seafood', 'pork'],
		want: ['paella', 'cocido', 'croquetas']
	},
	{
		name: 'diet: vegetarian OR pork',
		ids: ['vegetarian', 'pork'],
		want: ['tortilla', 'cocido', 'gazpacho', 'croquetas', 'arrozleche']
	},
	{
		name: 'course: tapas OR desserts',
		ids: ['tapas', 'desserts'],
		want: ['tortilla', 'gazpacho', 'croquetas', 'torrijas', 'arrozleche']
	},
	{
		name: 'course: mains OR desserts',
		ids: ['mains', 'desserts'],
		want: ['paella', 'cocido', 'torrijas', 'arrozleche']
	},
	{
		name: 'effort: quick OR slow-cooked is every dish',
		ids: ['quick', 'slow-cooked'],
		want: ALL_DISH_KEYS
	},
	{ name: 'season: summer OR winter', ids: ['summer', 'winter'], want: ['cocido', 'gazpacho'] },
	{
		name: 'season: easter OR all-year',
		ids: ['easter', 'all-year'],
		want: ['tortilla', 'paella', 'croquetas', 'torrijas', 'arrozleche']
	},
	{
		name: 'season: three of four',
		ids: ['winter', 'easter', 'summer'],
		want: ['cocido', 'gazpacho', 'torrijas']
	},
	{
		name: 'course: all three is every dish',
		ids: ['tapas', 'mains', 'desserts'],
		want: ALL_DISH_KEYS
	}
];

const ACROSS_GROUPS: Case[] = [
	{ name: 'vegetarian AND quick', ids: ['vegetarian', 'quick'], want: ['tortilla', 'gazpacho'] },
	{ name: 'vegetarian AND summer', ids: ['vegetarian', 'summer'], want: ['gazpacho'] },
	{ name: 'pork AND mains', ids: ['pork', 'mains'], want: ['cocido'] },
	{ name: 'quick AND desserts', ids: ['quick', 'desserts'], want: ['torrijas'] },
	{
		name: 'all four groups: seafood, mains, slow-cooked, all-year',
		ids: ['seafood', 'mains', 'slow-cooked', 'all-year'],
		want: ['paella']
	},
	{
		name: '(vegetarian OR pork) AND tapas AND quick',
		ids: ['vegetarian', 'pork', 'tapas', 'quick'],
		want: ['tortilla', 'gazpacho', 'croquetas']
	},
	{
		name: '(vegetarian OR seafood) AND desserts AND all-year',
		ids: ['vegetarian', 'seafood', 'desserts', 'all-year'],
		want: ['arrozleche']
	},
	{
		name: 'every course and every season is every dish',
		ids: ['tapas', 'mains', 'desserts', 'summer', 'winter', 'easter', 'all-year'],
		want: ALL_DISH_KEYS
	},
	{
		name: 'all twelve filters: every dish with a diet flag (torrijas has none)',
		ids: ALL_IDS,
		want: ['tortilla', 'paella', 'cocido', 'gazpacho', 'croquetas', 'arrozleche']
	}
];

const NO_MATCH: Case[] = [
	{ name: 'desserts AND summer (both quick chips)', ids: ['desserts', 'summer'], want: [] },
	{ name: 'seafood AND tapas', ids: ['seafood', 'tapas'], want: [] },
	{ name: 'vegetarian AND mains', ids: ['vegetarian', 'mains'], want: [] },
	{ name: 'pork AND quick AND winter', ids: ['pork', 'quick', 'winter'], want: [] }
];

function runCases(cases: Case[]) {
	for (const tc of cases) {
		it(`${tc.name}: ${tc.want.length ? tc.want.join(', ') : 'nothing'}`, async () => {
			await expectKeys(tc.ids, tc.want);
		});
	}
}

describe('filterDishes: no active filter', () => {
	it('returns every dish, in the order given', async () => {
		await expectKeys([], ALL_DISH_KEYS);
	});

	it('keeps a reversed list reversed (no re-sorting)', async () => {
		const reversed = [...dishesIn('en')].reverse();
		await expectKeys([], [...ALL_DISH_KEYS].reverse(), reversed);
	});

	it('returns nothing for an empty list', async () => {
		await expectKeys(['vegetarian'], [], []);
	});
});

describe('filterDishes: each single filter', () => runCases(SINGLE_FILTER));
describe('filterDishes: OR within a group', () => runCases(SAME_GROUP));
describe('filterDishes: AND across groups', () => runCases(ACROSS_GROUPS));
describe('filterDishes: combinations that match nothing', () => runCases(NO_MATCH));

describe('filterDishes: input handling', () => {
	it('the order of the active ids does not matter', async () => {
		await expectKeys(['quick', 'vegetarian'], ['tortilla', 'gazpacho']);
	});

	it('a repeated id counts once', async () => {
		await expectKeys(['vegetarian', 'vegetarian'], ['tortilla', 'gazpacho', 'arrozleche']);
	});

	it('an unknown id is ignored', async () => {
		await expectKeys(['vegan', 'summer'], ['gazpacho']);
		await expectKeys(['Vegetarian'], ALL_DISH_KEYS);
	});

	it('filters by flags and enums, never by translated text (ru gives the same dishes)', async () => {
		await expectKeys(['vegetarian', 'quick'], ['tortilla', 'gazpacho'], dishesIn('ru'));
	});

	it('keeps the filtered dishes in the order given', async () => {
		const reversed = [...dishesIn('en')].reverse();
		await expectKeys(['vegetarian'], ['arrozleche', 'gazpacho', 'tortilla'], reversed);
	});

	it('returns the same dish objects and leaves the input untouched', async () => {
		const filterDishes = await loadFilterDishes();
		const dishes = dishesIn('en');
		const before = JSON.stringify(dishes);
		const got = filterDishes(dishes, ['pork']);
		expect(got[0], 'got a copy, want the input dish object').toBe(dishes[2]);
		expect(JSON.stringify(dishes), 'got the input list mutated').toBe(before);
	});
});

// A dish with exactly these traits, so each test reads one field at a time.
function dishWith(
	key: string,
	traits: Partial<Pick<Dish, 'course' | 'season'>> & Partial<Dish['flags']> = {}
): Dish {
	const [template] = dishesIn('en');
	const { course = 'mains', season = 'winter', ...flags } = traits;
	const noFlags = {
		vegetarian: false,
		seafood: false,
		pork: false,
		quick: false,
		slowCooked: false
	};
	return { ...template, key, course, season, flags: { ...noFlags, ...flags } };
}

describe('filterDishes: one field per filter (synthetic dishes)', () => {
	const dishes = [
		dishWith('plain'),
		dishWith('both-diets', { seafood: true, pork: true }),
		dishWith('quick-and-slow', { quick: true, slowCooked: true }),
		dishWith('all-season', { season: 'all' }),
		dishWith('tapas-dish', { course: 'tapas' })
	];
	const cases: Case[] = [
		{ name: 'a dish with no flag never matches a diet filter', ids: ['vegetarian'], want: [] },
		{
			name: 'seafood and pork on one dish: either id matches',
			ids: ['pork'],
			want: ['both-diets']
		},
		{ name: 'quick and slow-cooked on one dish', ids: ['slow-cooked'], want: ['quick-and-slow'] },
		{ name: "all-year: only season 'all'", ids: ['all-year'], want: ['all-season'] },
		{
			name: "summer, winter, easter never match season 'all'",
			ids: ['summer', 'easter'],
			want: []
		},
		{
			name: 'winter matches only season winter',
			ids: ['winter'],
			want: ['plain', 'both-diets', 'quick-and-slow', 'tapas-dish']
		},
		{ name: 'course reads only course', ids: ['tapas'], want: ['tapas-dish'] }
	];
	for (const tc of cases) {
		it(tc.name, async () => {
			await expectKeys(tc.ids, tc.want, dishes);
		});
	}
});

// Every one of the 4096 subsets of the twelve ids, checked against the two
// laws OR-within / AND-across imply, without re-implementing the filter.
function subsetsOf<T>(items: readonly T[]): T[][] {
	return Array.from({ length: 2 ** items.length }, (_, mask) =>
		items.filter((_, i) => mask & (1 << i))
	);
}

const groupOf = (id: string) => WANT_GROUPS.find((group) => group.ids.includes(id))!.key;

const activeGroups = (ids: string[]) => new Set(ids.map(groupOf));

// Ids not yet active whose group already has an active id.
const sameGroupExtras = (ids: string[]) =>
	ALL_IDS.filter((id) => !ids.includes(id) && activeGroups(ids).has(groupOf(id)));

// Ids whose group has no active id yet.
const newGroupExtras = (ids: string[]) =>
	ALL_IDS.filter((id) => !activeGroups(ids).has(groupOf(id)));

const isSubsequence = (part: string[], whole: string[]) => {
	let at = 0;
	for (const key of whole) if (key === part[at]) at++;
	return at === part.length;
};

describe('filterDishes: laws over every combination', () => {
	it('the result is always an in-order subset of the input', async () => {
		const filterDishes = await loadFilterDishes();
		const dishes = dishesIn('en');
		for (const ids of subsetsOf(ALL_IDS)) {
			const got = keysOf(filterDishes(dishes, ids));
			expect(isSubsequence(got, ALL_DISH_KEYS), `${show(ids)}: got ${show(got)}`).toBe(true);
		}
	});

	it('adding an id to an active group never removes a dish (OR within a group)', async () => {
		const filterDishes = await loadFilterDishes();
		const dishes = dishesIn('en');
		for (const ids of subsetsOf(ALL_IDS)) {
			const before = new Set(keysOf(filterDishes(dishes, ids)));
			for (const extra of sameGroupExtras(ids)) {
				const after = keysOf(filterDishes(dishes, [...ids, extra]));
				const lost = [...before].filter((key) => !after.includes(key));
				expect(lost, `${show(ids)} + ${extra}: lost ${show(lost)}`).toEqual([]);
			}
		}
	});

	it('an id from a new group keeps exactly the dishes that id alone matches (AND across)', async () => {
		const filterDishes = await loadFilterDishes();
		const dishes = dishesIn('en');
		for (const ids of subsetsOf(ALL_IDS)) {
			const before = keysOf(filterDishes(dishes, ids));
			for (const extra of newGroupExtras(ids)) {
				const alone = new Set(keysOf(filterDishes(dishes, [extra])));
				const want = before.filter((key) => alone.has(key));
				const got = keysOf(filterDishes(dishes, [...ids, extra]));
				expect(got, `${show(ids)} + ${extra}: got ${show(got)}, want ${show(want)}`).toEqual(want);
			}
		}
	});
});
