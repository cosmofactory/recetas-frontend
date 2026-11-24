import { describe, expect, it } from 'vitest';
import { loadExport } from '../../testutil/load-export';
import { indexEntries, mockCatalog, show, type SearchEntry } from '../../testutil/search';

// FE-7: where a picked search result goes, one rule for both layouts.
//
// Sources:
// - Mobile README -> Overlay — Search: "dish or variation → switch to
//   Popular and open that dish's Variations page. Region → switch to
//   Regional and open that region's sheet."
// - Stage FE-7 -> Desktop search and menu: "on desktop, a variation result
//   opens its recipe directly (/:lang/dishes/:dishKey/:regionKey); on mobile,
//   it opens the dish's Variations page; dish and region results behave the
//   same in both."
//
// Decision pinned here (FE-7 PR 2): src/lib/search/result-href.ts exports
// searchResultHref(entry, lang, layout), layout 'mobile' | 'desktop', built
// with localizedHref. The switch to Popular for a dish or variation is the
// screen's navigation (the href is the Variations page itself); PR 4's
// desktop dropdown reuses the function.

type Layout = 'mobile' | 'desktop';
type SearchResultHref = (entry: SearchEntry, lang: string, layout: Layout) => string;

const loadHref = () =>
	loadExport<SearchResultHref>('src/lib/search/result-href.ts', 'searchResultHref');

const DISH: SearchEntry = {
	group: 'dish',
	title: 'Tortilla de patatas',
	subtitle: '13 variations',
	dishKey: 'tortilla'
};
const VARIATION: SearchEntry = {
	group: 'variation',
	title: 'Betanzos-style runny',
	subtitle: 'Galicia · Tortilla de patatas',
	dishKey: 'tortilla',
	regionKey: 'gal'
};
const REGION: SearchEntry = {
	group: 'region',
	title: 'Andalucía',
	subtitle: 'Gazpacho andaluz, Salmorejo cordobés, Pescaíto frito',
	regionKey: 'and',
	tileColor: '#C4552E'
};

type Case = { why: string; entry: SearchEntry; lang: string; layout: Layout; want: string };

const CASES: Case[] = [
	{
		why: 'a dish opens its Variations page (mobile)',
		entry: DISH,
		lang: 'en',
		layout: 'mobile',
		want: '/en/dishes/tortilla'
	},
	{
		why: 'a dish opens its Variations page (desktop)',
		entry: DISH,
		lang: 'en',
		layout: 'desktop',
		want: '/en/dishes/tortilla'
	},
	{
		why: 'a variation opens its dish on mobile',
		entry: VARIATION,
		lang: 'en',
		layout: 'mobile',
		want: '/en/dishes/tortilla'
	},
	{
		why: 'a variation opens its recipe on desktop',
		entry: VARIATION,
		lang: 'en',
		layout: 'desktop',
		want: '/en/dishes/tortilla/gal'
	},
	{
		why: 'a region opens its sheet (mobile)',
		entry: REGION,
		lang: 'en',
		layout: 'mobile',
		want: '/en/regions/and'
	},
	{
		why: 'a region opens its panel (desktop)',
		entry: REGION,
		lang: 'en',
		layout: 'desktop',
		want: '/en/regions/and'
	},
	{
		why: 'keeps the page language (ru dish)',
		entry: DISH,
		lang: 'ru',
		layout: 'mobile',
		want: '/ru/dishes/tortilla'
	},
	{
		why: 'keeps the page language (es variation)',
		entry: VARIATION,
		lang: 'es',
		layout: 'mobile',
		want: '/es/dishes/tortilla'
	},
	{
		why: 'keeps the page language (ru region)',
		entry: REGION,
		lang: 'ru',
		layout: 'mobile',
		want: '/ru/regions/and'
	}
];

describe('searchResultHref', () => {
	it.each(CASES)('$why', async ({ entry, lang, layout, want }) => {
		const searchResultHref = await loadHref();
		const got = searchResultHref(entry, lang, layout);
		expect(
			got,
			`searchResultHref(${show(entry.group)}, ${lang}, ${layout}): got ${show(got)}, want ${show(want)}`
		).toBe(want);
	});
});

// FE-11 (both READMEs -> "Spanish (Spain-wide) variations"): a Spanish
// variation's recipe is /:lang/dishes/:dishKey/esp/:variationSlug, and a dish
// with exactly one variation in total has no Variations page, so its search
// results (the dish and its variation) open the recipe on both layouts.
// Checked through buildIndex's entries, so which fields carry the slug and
// the single-variation target is the index's business.
const ARROZ_BLANCO = '/en/dishes/arrozblanco/esp/arroz-blanco-con-tomate';

type IndexCase = { why: string; match: Partial<SearchEntry>; layout: Layout; want: string };

const INDEX_CASES: IndexCase[] = [
	{
		why: 'a one-variation dish opens its recipe (mobile)',
		match: { group: 'dish', dishKey: 'arrozblanco' },
		layout: 'mobile',
		want: ARROZ_BLANCO
	},
	{
		why: 'a one-variation dish opens its recipe (desktop)',
		match: { group: 'dish', dishKey: 'arrozblanco' },
		layout: 'desktop',
		want: ARROZ_BLANCO
	},
	{
		why: "a one-variation dish's variation opens its recipe on mobile too",
		match: { group: 'variation', dishKey: 'arrozblanco' },
		layout: 'mobile',
		want: ARROZ_BLANCO
	},
	{
		why: "a one-variation dish's variation opens its recipe (desktop)",
		match: { group: 'variation', dishKey: 'arrozblanco' },
		layout: 'desktop',
		want: ARROZ_BLANCO
	},
	{
		why: 'a Spanish variation of a two-variation dish opens its recipe on desktop',
		match: { group: 'variation', title: 'Allioli de codony' },
		layout: 'desktop',
		want: '/en/dishes/allioli/esp/allioli-de-codony'
	},
	{
		why: 'a Spanish variation of a two-variation dish opens its dish on mobile',
		match: { group: 'variation', title: 'Allioli de morter' },
		layout: 'mobile',
		want: '/en/dishes/allioli'
	},
	{
		why: 'a two-variation Spanish dish opens its Variations page',
		match: { group: 'dish', dishKey: 'allioli' },
		layout: 'desktop',
		want: '/en/dishes/allioli'
	},
	{
		why: 'a regional variation from the index still opens its recipe (desktop)',
		match: { group: 'variation', dishKey: 'tortilla', regionKey: 'gal' },
		layout: 'desktop',
		want: '/en/dishes/tortilla/gal'
	}
];

async function indexEntry(match: Partial<SearchEntry>): Promise<SearchEntry> {
	const entries = await indexEntries(mockCatalog('en'), 'en');
	const keys = Object.entries(match) as [keyof SearchEntry, unknown][];
	const found = entries.find((entry) => keys.every(([key, value]) => entry[key] === value));
	expect(found, `no index entry ${show(match)}`).toBeDefined();
	return found!;
}

describe('searchResultHref on the index entries (FE-11)', () => {
	for (const { why, match, layout, want } of INDEX_CASES) {
		it(why, async () => {
			const searchResultHref = await loadHref();
			const got = searchResultHref(await indexEntry(match), 'en', layout);
			expect(got, `${show(match)} ${layout}: got ${show(got)}, want ${show(want)}`).toBe(want);
		});
	}
});
