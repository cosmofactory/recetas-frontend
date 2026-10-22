import type { Locale } from '#lib/i18n/locales.ts';
import type { Dish, Region } from '#lib/server/catalog-source.ts';
import { buildView } from '#lib/server/mock/bundle-mapping.ts';
import bundle from '#lib/server/mock/content.bundle.json';
import { loadExport } from './load-export';
import { NO_PHOTOS } from './catalog';

// Shared by the FE-7 search logic specs (src/lib/search/*.spec.ts): the API
// the tests assume, its loaders, small catalog fixtures and a compact way to
// compare results ("dish:tortilla", "variation:tortilla/gal", "region:and").

export type SearchGroupKey = 'dish' | 'variation' | 'region';

// Link targets: dish -> dishKey; variation -> dishKey + regionKey; region ->
// regionKey (+ its tile colour as the thumbnail). Extra fields are allowed.
export type SearchEntry = {
	group: SearchGroupKey;
	title: string;
	subtitle: string;
	dishKey?: string;
	regionKey?: string;
	tileColor?: string | null;
};

export type SearchGroup = { group: SearchGroupKey; entries: SearchEntry[] };
export type SearchCatalog = { regions: Region[]; dishes: Dish[] };

type Normalize = (s: string) => string;
type BuildIndex = (catalog: SearchCatalog, locale: Locale) => unknown;
type Search = (index: unknown, query: string) => SearchGroup[];

export const NORMALIZE_MODULE = 'src/lib/search/normalize.ts';
export const INDEX_MODULE = 'src/lib/search/search-index.ts';
export const SEARCH_MODULE = 'src/lib/search/search.ts';

export const loadNormalize = () => loadExport<Normalize>(NORMALIZE_MODULE, 'normalize');
export const loadBuildIndex = () => loadExport<BuildIndex>(INDEX_MODULE, 'buildIndex');
export const loadSearch = () => loadExport<Search>(SEARCH_MODULE, 'search');

export const show = (value: unknown) => JSON.stringify(value);

export function mockCatalog(lang: Locale): SearchCatalog {
	const { regions, dishes } = buildView(bundle, lang);
	return { regions, dishes };
}

// The index entries as a plain array, whatever container buildIndex returns.
export async function indexEntries(catalog: SearchCatalog, locale: Locale) {
	const buildIndex = await loadBuildIndex();
	return [...(buildIndex(catalog, locale) as Iterable<SearchEntry>)];
}

export async function searchCatalog(catalog: SearchCatalog, locale: Locale, query: string) {
	const [buildIndex, search] = await Promise.all([loadBuildIndex(), loadSearch()]);
	return search(buildIndex(catalog, locale), query);
}

export const searchMock = (lang: Locale, query: string) =>
	searchCatalog(mockCatalog(lang), lang, query);

export function entryRef(entry: SearchEntry): string {
	if (entry.group === 'variation') return `variation:${entry.dishKey}/${entry.regionKey}`;
	if (entry.group === 'region') return `region:${entry.regionKey}`;
	return `dish:${entry.dishKey}`;
}

export const groupRefs = (groups: SearchGroup[]) =>
	groups.map((g) => ({ group: g.group, refs: g.entries.map(entryRef) }));

export function refsIn(groups: SearchGroup[], group: SearchGroupKey): string[] {
	return groups.find((g) => g.group === group)?.entries.map(entryRef) ?? [];
}

type RegionFixture = Pick<Region, 'key' | 'name'> & Partial<Region>;
type VariationFixture = Pick<Dish['variations'][number], 'regionKey' | 'name'> &
	Partial<Dish['variations'][number]>;
type DishFixture = Pick<Dish, 'key' | 'name'> & { variations?: VariationFixture[] } & Partial<
		Omit<Dish, 'variations'>
	>;

export function fixtureRegion(fields: RegionFixture): Region {
	return {
		order: 1,
		nameEs: fields.name,
		mapLabel: fields.name,
		tileColor: '#9A9A5E',
		description: '',
		regionalDishes: [],
		...fields
	};
}

function fixtureVariation(fields: VariationFixture): Dish['variations'][number] {
	return {
		regionName: fields.regionKey,
		recipeKey: `${fields.regionKey}-recipe`,
		nameEs: fields.name,
		description: '',
		photos: NO_PHOTOS,
		...fields
	};
}

export function fixtureDish({ variations = [], ...fields }: DishFixture): Dish {
	return {
		order: 1,
		nameEs: fields.name,
		description: '',
		flags: { vegetarian: false, seafood: false, pork: false, quick: false, slowCooked: false },
		course: 'mains',
		season: 'all',
		photos: NO_PHOTOS,
		...fields,
		variations: variations.map(fixtureVariation)
	};
}
