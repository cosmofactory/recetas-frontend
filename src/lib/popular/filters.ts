import type { components } from '#lib/api/schema.d.ts';
import { POPULAR, TAB_PARAM } from '#lib/ui/home-tab.ts';

type Dish = components['schemas']['Dish'];
type DishTest = (dish: Dish) => boolean;

// Mobile README -> Filters sheet: four groups, "OR within a group, AND
// across groups". The one table of filters: group order, then the order in
// the group, is the canonical order every URL is written in (D-FE5-1). The
// ids are locale-independent ASCII, so a URL works in every language.
// "All year" is the data model's season 'all', not "any season".
const FILTER_TABLE = {
	diet: {
		vegetarian: (dish) => dish.flags.vegetarian,
		seafood: (dish) => dish.flags.seafood,
		pork: (dish) => dish.flags.pork
	},
	course: {
		tapas: (dish) => dish.course === 'tapas',
		mains: (dish) => dish.course === 'mains',
		desserts: (dish) => dish.course === 'desserts'
	},
	effort: {
		quick: (dish) => dish.flags.quick,
		'slow-cooked': (dish) => dish.flags.slowCooked
	},
	season: {
		summer: (dish) => dish.season === 'summer',
		winter: (dish) => dish.season === 'winter',
		easter: (dish) => dish.season === 'easter',
		'all-year': (dish) => dish.season === 'all'
	}
} as const satisfies Record<string, Record<string, DishTest>>;

type FilterTable = typeof FILTER_TABLE;
export type FilterGroupKey = keyof FilterTable;
export type FilterId = { [G in FilterGroupKey]: keyof FilterTable[G] }[FilterGroupKey];
export type FilterGroup = { key: FilterGroupKey; ids: readonly FilterId[] };

const GROUP_TESTS = Object.entries(FILTER_TABLE).map(
	([key, tests]) =>
		[key as FilterGroupKey, Object.entries(tests) as [FilterId, DishTest][]] as const
);

export const FILTER_GROUPS: readonly FilterGroup[] = GROUP_TESTS.map(([key, tests]) => ({
	key,
	ids: tests.map(([id]) => id)
}));

export const FILTER_IDS: readonly FilterId[] = FILTER_GROUPS.flatMap((group) => group.ids);

// Mobile README -> Filter bar: "4 quick chips: Vegetarian, Quick, Desserts, Summer".
export const QUICK_FILTER_IDS: readonly FilterId[] = ['vegetarian', 'quick', 'desserts', 'summer'];

export const FILTER_PARAM = 'f';
// D-FE5-2: the open dish sheet (mobile).
export const DISH_PARAM = 'dish';

// What the helpers read of a URL ($app/state's page.url is read-only).
type FilterSearch = { searchParams: Pick<URLSearchParams, 'getAll'> };
export type FilterUrl = FilterSearch & { pathname: string };
// A Popular URL that may also open a dish sheet (?dish).
export type DishUrl = FilterUrl & { searchParams: Pick<URLSearchParams, 'get'> };

// Keeps the dishes (in the order given) that pass, in every group with an
// active id, at least one of that group's active tests. Unknown ids are ignored.
export function filterDishes(dishes: readonly Dish[], activeIds: readonly string[]): Dish[] {
	const active = new Set(activeIds);
	const activeGroups = GROUP_TESTS.map(([, tests]) =>
		tests.filter(([id]) => active.has(id)).map(([, test]) => test)
	).filter((tests) => tests.length > 0);
	return dishes.filter((dish) => activeGroups.every((tests) => tests.some((test) => test(dish))));
}

// The known ids among `ids`, each once, in the canonical order.
function canonical(ids: Iterable<string>): FilterId[] {
	const wanted = new Set(ids);
	return FILTER_IDS.filter((id) => wanted.has(id));
}

export const parseFilters = (url: FilterSearch): FilterId[] =>
	canonical(url.searchParams.getAll(FILTER_PARAM));

export const serializeFilters = (ids: readonly string[]): URLSearchParams =>
	new URLSearchParams(canonical(ids).map((id) => [FILTER_PARAM, id]));

// The Popular tab at `pathname` (so the locale stays) with these filters;
// any other param of the current URL is dropped.
function popularHref(pathname: string, ids: readonly string[], extra: [string, string][] = []) {
	const params = new URLSearchParams([[TAB_PARAM, POPULAR]]);
	for (const [key, value] of [...serializeFilters(ids), ...extra]) params.append(key, value);
	return `${pathname}?${params}`;
}

export function toggleFilterHref(url: FilterUrl, id: string): string {
	const active: string[] = parseFilters(url);
	const next = active.includes(id) ? active.filter((other) => other !== id) : [...active, id];
	return popularHref(url.pathname, next);
}

export const clearFiltersHref = (url: FilterUrl): string => popularHref(url.pathname, []);

// A dish card's link: the same filtered list with that dish's sheet open.
export const dishSheetHref = (url: FilterUrl, dishKey: string): string =>
	popularHref(url.pathname, parseFilters(url), [[DISH_PARAM, dishKey]]);

// The dish whose sheet the URL opens, if any (the key may be unknown).
export const openDishKey = (url: DishUrl) => url.searchParams.get(DISH_PARAM) ?? undefined;

// The dish sheet's close: the same filtered list without its dish.
export const closeDishHref = (url: FilterUrl): string =>
	popularHref(url.pathname, parseFilters(url));
