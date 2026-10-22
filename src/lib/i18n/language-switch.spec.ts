import { describe, expect, it } from 'vitest';
import { loadExport } from '../../testutil/load-export';

// FE-7 PR 3, the language menu's row links (stage FE-7 -> Language menu):
// "Each language row is a link to /set-lang?to=<lang>&next=<same route and
// query in that locale> (localizedHref, FE-1)." The open sheet, tab and
// filters survive because they live in the URL.
//
// Contract: languageSwitchHref(url, to) in src/lib/i18n/set-lang.ts, next to
// setLangHref and safeNext. `url` is the current page URL; the result is
// setLangHref(to, localizedHref(<path without its locale> + search, to)).
// The fragment is dropped: /set-lang only accepts a path and query (safeNext).

type LanguageSwitchHref = (url: URL, to: string) => string;
type SafeNext = (to: string, next: string | null) => string;

const MODULE = 'src/lib/i18n/set-lang.ts';
const load = () => loadExport<LanguageSwitchHref>(MODULE, 'languageSwitchHref');
const loadSafeNext = () => loadExport<SafeNext>(MODULE, 'safeNext');

const ORIGIN = 'http://127.0.0.1:4173';
const pageUrl = (pathAndQuery: string) => new URL(pathAndQuery, ORIGIN);

const setLang = (to: string, next: string) => `/set-lang?to=${to}&next=${encodeURIComponent(next)}`;

const cases: { name: string; from: string; to: string; next: string }[] = [
	{ name: 'the home page', from: '/en/', to: 'ru', next: '/ru/' },
	{ name: 'the home page to itself', from: '/es/', to: 'es', next: '/es/' },
	{
		name: 'a region sheet URL',
		from: '/es/regions/gal',
		to: 'ru',
		next: '/ru/regions/gal'
	},
	{
		name: 'a region URL with a query',
		from: '/es/regions/gal?tab=regional',
		to: 'ru',
		next: '/ru/regions/gal?tab=regional'
	},
	{
		name: 'Popular with repeated filters and a dish sheet, in order',
		from: '/en/?tab=popular&f=tapas&f=mains&dish=tortilla',
		to: 'es',
		next: '/es/?tab=popular&f=tapas&f=mains&dish=tortilla'
	},
	{
		name: 'a Variations page',
		from: '/ru/dishes/tortilla',
		to: 'en',
		next: '/en/dishes/tortilla'
	},
	{
		name: 'a Recipe page',
		from: '/en/dishes/tortilla/gal',
		to: 'ru',
		next: '/ru/dishes/tortilla/gal'
	},
	{
		name: 'a fragment is dropped',
		from: '/en/dishes/tortilla#steps',
		to: 'es',
		next: '/es/dishes/tortilla'
	}
];

describe('languageSwitchHref', () => {
	for (const tc of cases) {
		it(`${tc.name}: ${tc.from} -> ${tc.to}`, async () => {
			const got = (await load())(pageUrl(tc.from), tc.to);
			const want = setLang(tc.to, tc.next);
			expect(got, `got ${got}, want ${want}`).toBe(want);
		});
	}

	// The link must survive /set-lang's open-redirect check unchanged, or the
	// user would land on the bare home instead of the same page.
	for (const tc of cases) {
		it(`${tc.name}: next passes safeNext unchanged`, async () => {
			const href = (await load())(pageUrl(tc.from), tc.to);
			const params = new URL(href, ORIGIN).searchParams;
			const next = params.get('next');
			const kept = (await loadSafeNext())(tc.to, next);
			expect(params.get('to'), `got to=${params.get('to')}, want ${tc.to}`).toBe(tc.to);
			expect(kept, `got safeNext ${kept}, want next ${next} kept`).toBe(next);
		});
	}

	it('is a root-relative /set-lang link (no origin)', async () => {
		const got = (await load())(pageUrl('/en/regions/gal'), 'ru');
		expect(got.startsWith('/set-lang?'), `got ${got}, want /set-lang?…`).toBe(true);
	});
});
