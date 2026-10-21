import { describe, expect, it } from 'vitest';
import { loadExport } from '../../testutil/load-export';

// FE-5 PR 1, the active filters in the URL (D-FE5-1, owner 2026-10-21):
// "Repeated `f` params with locale-independent ASCII ids; unknown ids dropped
// silently; serialized in a stable order", e.g.
// /:lang/?tab=popular&f=vegetarian&f=summer. The URL is the single source of
// truth (stage FE-5 -> Filter bar: the quick chips and the sheet "stay in
// sync, because the URL is the single source of truth"), so the same URL
// works in every language.
//
// Decisions pinned here (FE-5 PR 1):
// - src/lib/popular/filters.ts exports FILTER_PARAM ('f'),
//   parseFilters(url), serializeFilters(ids), toggleFilterHref(url, id) and
//   clearFiltersHref(url).
// - parseFilters takes anything with `searchParams` (a URL, $app/state's
//   page.url) and returns the known ids, each once, in the canonical order
//   (FILTER_IDS: diet, course, effort, season, then the order in the group).
//   Ids are case-sensitive: `Vegetarian` is unknown.
// - serializeFilters returns a URLSearchParams holding only `f` entries,
//   canonical, deduplicated, unknown ids dropped.
// - toggleFilterHref / clearFiltersHref return the next same-page href as
//   path + query: the current pathname (so the locale stays), then
//   `tab=popular` first, then the filters in canonical order. Any other param
//   (`dish`, a tracking param) is dropped: changing the filters changes the
//   list, so no dish sheet stays open on it.

type HasSearchParams = { searchParams: URLSearchParams };
type ParseFilters = (url: HasSearchParams) => string[];
type SerializeFilters = (ids: readonly string[]) => URLSearchParams;
type FilterHref = (url: URL, id: string) => string;
type ClearHref = (url: URL) => string;

const MODULE = 'src/lib/popular/filters.ts';
const ORIGIN = 'https://asadorov.test';

const CANONICAL = [
	'vegetarian',
	'seafood',
	'pork',
	'tapas',
	'mains',
	'desserts',
	'quick',
	'slow-cooked',
	'summer',
	'winter',
	'easter',
	'all-year'
];

const show = (value: unknown) => JSON.stringify(value);
const urlOf = (pathAndQuery: string) => new URL(pathAndQuery, ORIGIN);

describe('FILTER_PARAM', () => {
	it("is 'f'", async () => {
		const param = await loadExport<string>(MODULE, 'FILTER_PARAM');
		expect(param, `got ${show(param)}`).toBe('f');
	});
});

describe('parseFilters', () => {
	const cases: { name: string; url: string; want: string[] }[] = [
		{ name: 'no f param: no filters', url: '/en/?tab=popular', want: [] },
		{ name: 'no query at all', url: '/en/', want: [] },
		{ name: 'one id', url: '/en/?tab=popular&f=vegetarian', want: ['vegetarian'] },
		{
			name: 'repeated f params',
			url: '/en/?tab=popular&f=vegetarian&f=summer',
			want: ['vegetarian', 'summer']
		},
		{
			name: 'canonical order whatever the URL order',
			url: '/en/?f=all-year&f=quick&f=pork&f=tapas',
			want: ['pork', 'tapas', 'quick', 'all-year']
		},
		{
			name: 'duplicates collapse to one',
			url: '/en/?f=summer&f=summer&f=vegetarian&f=summer',
			want: ['vegetarian', 'summer']
		},
		{
			name: 'unknown ids are dropped silently',
			url: '/en/?f=vegan&f=quick&f=&f=Vegetarian&f=slow_cooked',
			want: ['quick']
		},
		{ name: 'only unknown ids: no filters', url: '/en/?f=bogus', want: [] },
		{
			name: 'f params in any position among other params',
			url: '/ru/?f=winter&tab=popular&dish=cocido&f=mains',
			want: ['mains', 'winter']
		},
		{
			name: 'every id',
			url: `/en/?${CANONICAL.map((id) => `f=${id}`).join('&')}`,
			want: CANONICAL
		},
		{
			name: 'every id, reversed and repeated',
			url: `/en/?${[...CANONICAL, ...CANONICAL]
				.reverse()
				.map((id) => `f=${id}`)
				.join('&')}`,
			want: CANONICAL
		},
		{ name: 'a comma list is not the encoding', url: '/en/?f=vegetarian,summer', want: [] }
	];
	for (const tc of cases) {
		it(`${tc.name}: ${tc.url}`, async () => {
			const parseFilters = await loadExport<ParseFilters>(MODULE, 'parseFilters');
			const got = parseFilters(urlOf(tc.url));
			expect(got, `got ${show(got)}, want ${show(tc.want)}`).toEqual(tc.want);
		});
	}

	it('reads a bare URLSearchParams holder (e.g. page.url)', async () => {
		const parseFilters = await loadExport<ParseFilters>(MODULE, 'parseFilters');
		const got = parseFilters({ searchParams: new URLSearchParams('f=desserts&f=quick') });
		expect(got, `got ${show(got)}`).toEqual(['desserts', 'quick']);
	});
});

describe('serializeFilters', () => {
	const cases: { name: string; ids: string[]; want: string }[] = [
		{ name: 'nothing', ids: [], want: '' },
		{ name: 'one id', ids: ['summer'], want: 'f=summer' },
		{ name: 'canonical order', ids: ['summer', 'vegetarian'], want: 'f=vegetarian&f=summer' },
		{ name: 'duplicates once', ids: ['quick', 'quick'], want: 'f=quick' },
		{ name: 'unknown ids dropped', ids: ['vegan', 'easter', ''], want: 'f=easter' },
		{
			name: 'every id',
			ids: [...CANONICAL].reverse(),
			want: CANONICAL.map((id) => `f=${id}`).join('&')
		}
	];
	for (const tc of cases) {
		it(`${tc.name}: ${show(tc.ids)} → "${tc.want}"`, async () => {
			const serializeFilters = await loadExport<SerializeFilters>(MODULE, 'serializeFilters');
			const got = serializeFilters(tc.ids).toString();
			expect(got, `got "${got}", want "${tc.want}"`).toBe(tc.want);
		});
	}

	it('holds only f entries', async () => {
		const serializeFilters = await loadExport<SerializeFilters>(MODULE, 'serializeFilters');
		const keys = new Set(serializeFilters(['pork', 'mains']).keys());
		expect([...keys], `got keys ${show([...keys])}`).toEqual(['f']);
	});
});

describe('parseFilters ∘ serializeFilters round-trip', () => {
	const inputs: string[][] = [
		[],
		['vegetarian'],
		['summer', 'vegetarian'],
		['all-year', 'easter', 'winter', 'summer'],
		['slow-cooked', 'quick', 'slow-cooked'],
		['nope', 'desserts'],
		[...CANONICAL].reverse()
	];
	for (const ids of inputs) {
		it(`${show(ids)} comes back canonical`, async () => {
			const parseFilters = await loadExport<ParseFilters>(MODULE, 'parseFilters');
			const serializeFilters = await loadExport<SerializeFilters>(MODULE, 'serializeFilters');
			const want = CANONICAL.filter((id) => ids.includes(id));
			const once = parseFilters(urlOf(`/en/?${serializeFilters(ids)}`));
			expect(once, `got ${show(once)}, want ${show(want)}`).toEqual(want);
			const twice = serializeFilters(once).toString();
			expect(twice, 'want serialize(parse(serialize(x))) = serialize(x)').toBe(
				serializeFilters(ids).toString()
			);
		});
	}
});

describe('toggleFilterHref: the next href for a chip', () => {
	const cases: { name: string; from: string; id: string; want: string }[] = [
		{
			name: 'turns the first filter on',
			from: '/en/?tab=popular',
			id: 'vegetarian',
			want: '/en/?tab=popular&f=vegetarian'
		},
		{
			name: 'adds a filter in canonical order',
			from: '/en/?tab=popular&f=summer',
			id: 'vegetarian',
			want: '/en/?tab=popular&f=vegetarian&f=summer'
		},
		{
			name: 'turns an active filter off',
			from: '/en/?tab=popular&f=vegetarian&f=summer',
			id: 'vegetarian',
			want: '/en/?tab=popular&f=summer'
		},
		{
			name: 'turning the last filter off leaves the bare Popular tab',
			from: '/es/?tab=popular&f=quick',
			id: 'quick',
			want: '/es/?tab=popular'
		},
		{
			name: 'keeps the locale path',
			from: '/ru/?tab=popular&f=desserts',
			id: 'quick',
			want: '/ru/?tab=popular&f=desserts&f=quick'
		},
		{
			name: 'writes tab=popular first even when the URL had it elsewhere',
			from: '/en/?f=mains&tab=popular',
			id: 'pork',
			want: '/en/?tab=popular&f=pork&f=mains'
		},
		{
			name: 'adds tab=popular when the URL lacks it',
			from: '/en/?f=winter',
			id: 'mains',
			want: '/en/?tab=popular&f=mains&f=winter'
		},
		{
			name: 'normalises a messy URL: duplicates and unknown ids gone',
			from: '/en/?tab=popular&f=summer&f=bogus&f=summer',
			id: 'tapas',
			want: '/en/?tab=popular&f=tapas&f=summer'
		},
		{
			name: 'drops other params (an open dish sheet, tracking)',
			from: '/en/?tab=popular&dish=tortilla&utm_source=x&f=quick',
			id: 'summer',
			want: '/en/?tab=popular&f=quick&f=summer'
		}
	];
	for (const tc of cases) {
		it(`${tc.name}: ${tc.from} + ${tc.id}`, async () => {
			const toggleFilterHref = await loadExport<FilterHref>(MODULE, 'toggleFilterHref');
			const got = toggleFilterHref(urlOf(tc.from), tc.id);
			expect(got, `got ${got}, want ${tc.want}`).toBe(tc.want);
		});
	}

	it('toggling twice comes back to the canonical URL', async () => {
		const toggleFilterHref = await loadExport<FilterHref>(MODULE, 'toggleFilterHref');
		const start = '/en/?tab=popular&f=vegetarian&f=winter';
		const on = toggleFilterHref(urlOf(start), 'quick');
		const off = toggleFilterHref(urlOf(on), 'quick');
		expect(off, `got ${off}, want ${start}`).toBe(start);
	});
});

describe('clearFiltersHref: "Clear all"', () => {
	const cases: { from: string; want: string }[] = [
		{ from: '/en/?tab=popular&f=desserts&f=summer', want: '/en/?tab=popular' },
		{ from: '/ru/?tab=popular&f=vegetarian', want: '/ru/?tab=popular' },
		{ from: '/es/?tab=popular', want: '/es/?tab=popular' },
		{ from: '/en/?f=quick&dish=tortilla', want: '/en/?tab=popular' }
	];
	for (const tc of cases) {
		it(`${tc.from} → ${tc.want}`, async () => {
			const clearFiltersHref = await loadExport<ClearHref>(MODULE, 'clearFiltersHref');
			const got = clearFiltersHref(urlOf(tc.from));
			expect(got, `got ${got}, want ${tc.want}`).toBe(tc.want);
		});
	}
});
