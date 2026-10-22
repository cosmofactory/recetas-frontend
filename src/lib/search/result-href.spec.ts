import { describe, expect, it } from 'vitest';
import { loadExport } from '../../testutil/load-export';
import { show, type SearchEntry } from '../../testutil/search';

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
