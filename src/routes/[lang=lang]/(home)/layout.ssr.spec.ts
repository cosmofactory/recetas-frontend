import { createRawSnippet, type Component, type Snippet } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import bundle from '#lib/server/mock/content.bundle.json';
import { buildView } from '#lib/server/mock/bundle-mapping.ts';
import { loadExport } from '../../../testutil/load-export';
import {
	decodeAmp,
	elementHtml,
	headingTexts,
	startTags,
	visibleText,
	type StartTag
} from '../../../testutil/html';
import type { Lang, Region } from '../../../testutil/map';

// FE-4 PR 2, the home shell rendered on the server (svelte/server). Stage
// FE-4 -> Small decisions: home (/:lang/) and /:lang/regions/:regionKey
// share one route-group layout, src/routes/[lang=lang]/(home)/+layout.svelte,
// which renders the header and the map and reads its state from the URL
// (`page`). The layout gets the [lang=lang] layout's data (`regions`,
// `dishes`, `origin`, `mediaBaseUrl`).
//
// What the server HTML must carry (every URL is shareable and indexable,
// and the acceptance checks deep links with JavaScript disabled):
// - Meta row (stage FE-4 -> Meta row): "Shows the regionsCount eyebrow with
//   a plural from the API count". The design's home.regionsCount is the
//   fixed "14 regions"; the count comes from the API's list, through the
//   plural message home_region (extra-strings.json). Here the layout gets
//   fewer regions than 14 and the eyebrow must follow.
// - Header (mobile README -> Screen 1 -> Header; desktop README -> Top
//   bar): the logo "Asadorov" is never translated; the switch labels,
//   the language button's label and the search button's name are messages.
// - Tab state lives in the URL (stage FE-4 -> Header): Regional is no `tab`
//   param, Popular is ?tab=popular; anything else is Regional (as the head
//   links already treat it). Popular replaces the map entirely (mobile
//   README -> Popular tab: "no map in Popular").
//
// Paraglide reads the request's locale from the store hooks.server.ts fills
// (withRequestLocale), so each render runs inside it.

type LayoutData = {
	origin: string;
	mediaBaseUrl: string | undefined;
	regions: Region[];
	dishes: unknown[];
};
type LayoutProps = { data: LayoutData; children: Snippet };

const LAYOUT = 'src/routes/[lang=lang]/(home)/+layout.svelte';
const ORIGIN = 'http://localhost';

type RenderSpec = { lang: Lang; path?: string; regionCount?: number };

function layoutData(lang: Lang, regionCount: number): LayoutData {
	const view = buildView(bundle, lang);
	return {
		origin: ORIGIN,
		mediaBaseUrl: undefined,
		regions: view.regions.slice(0, regionCount),
		dishes: view.dishes
	};
}

// What $app/state's `page` holds for a URL under the (home) group.
function pageState(url: URL, data: LayoutData) {
	const [lang, section, regionKey] = url.pathname.split('/').filter(Boolean);
	const inRegion = section === 'regions' && regionKey !== undefined;
	return {
		params: inRegion ? { lang, regionKey } : { lang },
		route: { id: inRegion ? '/[lang=lang]/(home)/regions/[regionKey]' : '/[lang=lang]/(home)' },
		url,
		data,
		status: 200,
		error: null,
		form: null,
		state: {}
	};
}

const pageSlot = createRawSnippet(() => ({ render: () => '<span data-page-slot></span>' }));

async function renderHome(spec: RenderSpec): Promise<string> {
	const data = layoutData(spec.lang, spec.regionCount ?? 14);
	const url = new URL(spec.path ?? `/${spec.lang}/`, ORIGIN);
	vi.resetModules();
	vi.doMock('$app/state', () => ({ page: pageState(url, data), navigating: null }));
	vi.doMock('$app/navigation', () => ({
		goto: vi.fn(),
		onNavigate: vi.fn(),
		afterNavigate: vi.fn(),
		beforeNavigate: vi.fn()
	}));
	const Layout = await loadExport<Component<LayoutProps>>(LAYOUT, 'default');
	// After resetModules, so the layout, the renderer and the locale store
	// share one Svelte runtime and one Paraglide runtime.
	const { render } = await import('svelte/server');
	const { withRequestLocale } = await import('#lib/server/request-locale.ts');
	// `body` is read inside the store: the render result builds it on access.
	return withRequestLocale(
		spec.lang,
		() => render(Layout, { props: { data, children: pageSlot } }).body
	);
}

afterEach(() => {
	vi.doUnmock('$app/state');
	vi.doUnmock('$app/navigation');
});

type Tab = { tag: string; href: string | null; selected: boolean; label: string };

// Every role="tab" element (a link since the PR 2 review): its tag, href,
// aria-selected and text.
function tabsIn(html: string): Tab[] {
	const tabs = html.match(/<(a|button)\b[^>]*\brole="tab"[^>]*>[\s\S]*?<\/\1>/g) ?? [];
	return tabs.map((tab) => ({
		tag: /^<(\w+)/.exec(tab)![1],
		href: /\bhref="([^"]*)"/.exec(tab)?.[1] ?? null,
		selected: /\baria-selected="true"/.test(tab),
		label: visibleText(tab)
	}));
}

// The first time the layout compiles (with the header, map and every
// component it uses) can pass Vitest's 5s default under a full parallel run.
const COLD_COMPILE_TIMEOUT_MS = 30_000;

describe(
	'(home) layout: regions eyebrow from the API count',
	{ timeout: COLD_COMPILE_TIMEOUT_MS },
	() => {
		const cases: { lang: Lang; regionCount: number; want: string }[] = [
			{ lang: 'en', regionCount: 14, want: '14 regions' },
			{ lang: 'es', regionCount: 14, want: '14 regiones' },
			{ lang: 'ru', regionCount: 14, want: '14 регионов' },
			{ lang: 'en', regionCount: 1, want: '1 region' },
			{ lang: 'en', regionCount: 5, want: '5 regions' },
			{ lang: 'es', regionCount: 1, want: '1 región' },
			{ lang: 'ru', regionCount: 1, want: '1 регион' },
			{ lang: 'ru', regionCount: 2, want: '2 региона' },
			{ lang: 'ru', regionCount: 5, want: '5 регионов' }
		];
		for (const tc of cases) {
			it(`reads "${tc.want}" with ${tc.regionCount} regions in ${tc.lang}`, async () => {
				const text = visibleText(await renderHome(tc));
				expect(text, `got no "${tc.want}" in: ${text.slice(0, 300)}`).toContain(tc.want);
			});
		}

		it('does not show the fixed "14 regions" when the API returns 5', async () => {
			const text = visibleText(await renderHome({ lang: 'en', regionCount: 5 }));
			expect(text, 'got the design\'s fixed "14 regions", want the API count').not.toContain(
				'14 regions'
			);
		});
	}
);

type Copy = {
	regional: string;
	popular: string;
	tapRegion: string;
	clickRegion: string;
	aboutTitle: string;
	language: string;
	search: string;
};

// strings.json home.* and desktop.*, extra-strings.json a11y.search.
const COPY: Record<Lang, Copy> = {
	en: {
		regional: 'Regional',
		popular: 'Popular',
		tapRegion: 'Tap a region to preview',
		clickRegion: 'Click a region to explore',
		aboutTitle: 'How Spain really cooks',
		language: 'Language',
		search: 'Search'
	},
	es: {
		regional: 'Regional',
		popular: 'Popular',
		tapRegion: 'Toca una región',
		clickRegion: 'Haz clic en una región',
		aboutTitle: 'Así cocina España de verdad',
		language: 'Idioma',
		search: 'Buscar'
	},
	ru: {
		regional: 'По регионам',
		popular: 'Популярное',
		tapRegion: 'Нажмите на регион',
		clickRegion: 'Выберите регион на карте',
		aboutTitle: 'Как на самом деле готовит Испания',
		language: 'Язык',
		search: 'Поиск'
	}
};

describe(
	'(home) layout: localized header and meta row',
	{ timeout: COLD_COMPILE_TIMEOUT_MS },
	() => {
		for (const lang of ['en', 'es', 'ru'] as const) {
			const copy = COPY[lang];

			it(`renders the ${lang} copy of both layouts`, async () => {
				const text = visibleText(await renderHome({ lang }));
				const texts = [
					copy.regional,
					copy.popular,
					copy.tapRegion,
					copy.clickRegion,
					copy.aboutTitle
				];
				for (const want of [...texts, copy.language]) {
					expect(text, `got no "${want}" in the ${lang} home`).toContain(want);
				}
			});

			it(`names the search button "${copy.search}" in ${lang}`, async () => {
				const html = await renderHome({ lang });
				expect(html, `got no aria-label="${copy.search}"`).toContain(`aria-label="${copy.search}"`);
			});

			it(`keeps the logo "Asadorov" untranslated in ${lang}`, async () => {
				const text = visibleText(await renderHome({ lang }));
				expect(text, 'got no "Asadorov" logo').toContain('Asadorov');
			});
		}

		it('renders the page itself inside the layout', async () => {
			const html = await renderHome({ lang: 'en' });
			expect(html, 'got no children() output').toContain('data-page-slot');
		});
	}
);

describe('(home) layout: tab state from the URL', { timeout: COLD_COMPILE_TIMEOUT_MS }, () => {
	const cases: { path: string; want: 'regional' | 'popular' }[] = [
		{ path: '/en/', want: 'regional' },
		{ path: '/en/?tab=popular', want: 'popular' },
		{ path: '/en/?utm=x&tab=popular', want: 'popular' },
		{ path: '/en/?tab=regional', want: 'regional' },
		{ path: '/en/?tab=bogus', want: 'regional' },
		{ path: '/en/regions/gal', want: 'regional' },
		// Stage FE-4 -> Small decisions: a region URL always shows Regional.
		{ path: '/en/regions/gal?tab=popular', want: 'regional' }
	];
	for (const tc of cases) {
		it(`${tc.path} selects ${tc.want}`, async () => {
			const tabs = tabsIn(await renderHome({ lang: 'en', path: tc.path }));
			expect(tabs.length, 'got no tabs, want the Regional | Popular switch').toBeGreaterThan(0);
			const selected = tabs.filter((t) => t.selected).map((t) => t.label);
			const label = COPY.en[tc.want];
			// One selected tab per switch (the mobile header and the desktop top bar).
			expect(selected.length, `got selected ${JSON.stringify(selected)}`).toBe(tabs.length / 2);
			for (const got of selected) expect(got, `got "${got}" selected, want ${label}`).toBe(label);
		});
	}

	it('renders the map on a region URL with ?tab=popular', async () => {
		const html = await renderHome({ lang: 'en', path: '/en/regions/gal?tab=popular' });
		expect(html, 'got no region map on /en/regions/gal?tab=popular').toContain(
			'data-testid="region-map"'
		);
	});

	it('renders the map on the Regional tab', async () => {
		const html = await renderHome({ lang: 'en', path: '/en/' });
		expect(html, 'got no region map on /en/').toContain('data-testid="region-map"');
	});

	it('renders no map on the Popular tab', async () => {
		const html = await renderHome({ lang: 'en', path: '/en/?tab=popular' });
		expect(html, 'got the region map on ?tab=popular').not.toContain('data-testid="region-map"');
	});

	it('renders a tabpanel on either tab', async () => {
		for (const path of ['/en/', '/en/?tab=popular']) {
			const html = await renderHome({ lang: 'en', path });
			expect(html, `got no role="tabpanel" on ${path}`).toMatch(/\brole="tabpanel"/);
		}
	});
});

// Stage FE-4 -> Small decisions, "Tabs are links": each tab is
// <a role="tab" href> to /:lang/ or /:lang/?tab=popular, so switching works
// without JS and crawlers find the Popular URL. The hrefs never keep a
// region ("Switching tabs closes any open sheet").
describe('(home) layout: tabs are links', { timeout: COLD_COMPILE_TIMEOUT_MS }, () => {
	const cases: { lang: Lang; path: string }[] = [
		{ lang: 'en', path: '/en/' },
		{ lang: 'ru', path: '/ru/?tab=popular' },
		{ lang: 'es', path: '/es/regions/gal' }
	];
	for (const tc of cases) {
		it(`${tc.path}: every tab is a link to its tab URL`, async () => {
			const tabs = tabsIn(await renderHome(tc));
			const copy = COPY[tc.lang];
			const want: Record<string, string> = {
				[copy.regional]: `/${tc.lang}/`,
				[copy.popular]: `/${tc.lang}/?tab=popular`
			};
			expect(tabs.length, 'want both switches').toBe(4);
			for (const t of tabs) {
				expect(t.tag, `got <${t.tag}> for "${t.label}", want <a>`).toBe('a');
				expect(t.href, `got href ${t.href} for "${t.label}"`).toBe(want[t.label]);
			}
		});
	}
});

// FE-4 PR 3, region details in the server HTML (stage FE-4 -> Region sheet,
// Desktop Regional, Acceptance): "A direct load of /:lang/regions/:key
// server-renders the map with the sheet open in peek"; "Deep link
// /ru/regions/gal server-renders with the sheet in peek and Russian text
// (check with JavaScript disabled: the content is present in the HTML)".
// Desktop: the region panel is always visible and "Andalucía is selected by
// default only when the URL has no region".
//
// Decisions pinned here: the mobile sheet is the BottomSheet (role="dialog",
// data-state, named by the region) and the desktop panel the StickyPanel (a
// <section> named by the region); both are in the HTML (CSS hides one), so
// a no-JS page of either width has its content. On /:lang/ the sheet is
// hidden (inert) and the panel shows Andalucía. The region name is an <h2>
// (the page's <h1>s stay the logo and the about title).

function sheetTag(html: string): StartTag {
	const dialogs = startTags(html).filter((t) => t.attrs.role === 'dialog');
	expect(dialogs.length, 'want one region sheet (role="dialog") in the HTML').toBe(1);
	return dialogs[0];
}

// Dialogs that are shown: a BottomSheet not in data-state="hidden", or any
// other dialog (the Filters OverlaySheet) that isn't inert.
function openDialogs(html: string): string[] {
	return startTags(html)
		.filter((t) => t.attrs.role === 'dialog')
		.filter((t) =>
			'data-state' in t.attrs ? t.attrs['data-state'] !== 'hidden' : !('inert' in t.attrs)
		)
		.map((t) => t.attrs['aria-label'] ?? '(unnamed)');
}

function panelNames(html: string): string[] {
	return startTags(html)
		.filter((t) => t.name === 'section' && t.attrs['aria-label'] !== undefined)
		.map((t) => t.attrs['aria-label']);
}

const GALICIA_RU = {
	name: 'Галисия',
	description: 'Атлантические морепродукты, еда паломников и самый любимый осьминог Испании.',
	count: '4 варианта',
	chips: ['Pulpo á feira', 'Empanada gallega', 'Lacón con grelos'],
	rows: [
		{ dishKey: 'tortilla', name: 'По-бетансосски, жидкая внутри' },
		{ dishKey: 'cocido', name: 'Cocido gallego' },
		{ dishKey: 'croquetas', name: 'De marisco' },
		{ dishKey: 'torrijas', name: 'Filloas' }
	]
};

const ANDALUCIA_EN_DESCRIPTION = 'Cold soups, fried fish and eight provinces of contrasts.';

describe(
	'(home) layout: region sheet in the server HTML',
	{ timeout: COLD_COMPILE_TIMEOUT_MS },
	() => {
		it('/ru/regions/gal: the sheet is in peek, not inert, named Галисия', async () => {
			const sheet = sheetTag(await renderHome({ lang: 'ru', path: '/ru/regions/gal' }));
			expect(sheet.attrs['data-state'], 'want the sheet in peek').toBe('peek');
			expect('inert' in sheet.attrs, 'got an inert sheet in peek').toBe(false);
			expect(sheet.attrs['aria-label']).toBe(GALICIA_RU.name);
		});

		it('/ru/regions/gal: the Russian region content is in the HTML', async () => {
			const text = visibleText(await renderHome({ lang: 'ru', path: '/ru/regions/gal' }));
			const wants = [
				GALICIA_RU.name,
				GALICIA_RU.description,
				GALICIA_RU.count,
				...GALICIA_RU.chips,
				...GALICIA_RU.rows.map((r) => r.name)
			];
			for (const want of wants) expect(text, `got no "${want}"`).toContain(want);
		});

		it('/ru/regions/gal: every row links to its Russian recipe URL', async () => {
			const html = await renderHome({ lang: 'ru', path: '/ru/regions/gal' });
			const hrefs = new Set(startTags(html).map((t) => t.attrs.href));
			for (const row of GALICIA_RU.rows) {
				const href = `/ru/dishes/${row.dishKey}/gal`;
				expect(hrefs.has(href), `got no link to ${href}`).toBe(true);
			}
		});

		it('/en/: the sheet is hidden and inert', async () => {
			const sheet = sheetTag(await renderHome({ lang: 'en', path: '/en/' }));
			expect(sheet.attrs['data-state'], 'want the sheet hidden on the bare home').toBe('hidden');
			expect('inert' in sheet.attrs, 'want the hidden sheet inert').toBe(true);
		});

		it('/en/regions/and: the sheet is in peek on a region URL', async () => {
			const sheet = sheetTag(await renderHome({ lang: 'en', path: '/en/regions/and' }));
			expect(sheet.attrs['data-state']).toBe('peek');
			expect(sheet.attrs['aria-label']).toBe('Andalucía');
		});
	}
);

describe(
	'(home) layout: desktop region panel in the server HTML',
	{ timeout: COLD_COMPILE_TIMEOUT_MS },
	() => {
		it('/en/: the panel shows Andalucía, the default', async () => {
			const html = await renderHome({ lang: 'en', path: '/en/' });
			expect(panelNames(html), 'want one panel, named Andalucía').toEqual(['Andalucía']);
			expect(visibleText(html), 'got no Andalucía description').toContain(ANDALUCIA_EN_DESCRIPTION);
		});

		it('/en/regions/gal: the panel shows Galicia, not Andalucía', async () => {
			const html = await renderHome({ lang: 'en', path: '/en/regions/gal' });
			expect(panelNames(html)).toEqual(['Galicia']);
			expect(visibleText(html), 'got the default region on a region URL').not.toContain(
				ANDALUCIA_EN_DESCRIPTION
			);
		});

		it('/ru/: the default panel is in Russian', async () => {
			const html = await renderHome({ lang: 'ru', path: '/ru/' });
			expect(panelNames(html)).toEqual(['Андалусия']);
		});

		// FE-5 PR 2: a closed Filters sheet (OverlaySheet, no data-state) may be
		// in the HTML too; closed means inert.
		it('/en/?tab=popular: no region panel and no open sheet', async () => {
			const html = await renderHome({ lang: 'en', path: '/en/?tab=popular' });
			expect(panelNames(html), 'got a region panel on Popular').toEqual([]);
			expect(openDialogs(html), 'got an open sheet on Popular').toEqual([]);
		});
	}
);

describe('(home) layout: region headings', { timeout: COLD_COMPILE_TIMEOUT_MS }, () => {
	it('/en/regions/gal: the region name is an <h2>, never an <h1>', async () => {
		const html = await renderHome({ lang: 'en', path: '/en/regions/gal' });
		expect(headingTexts(html, 2), 'want Galicia as an <h2>').toContain('Galicia');
		expect(headingTexts(html, 1), 'got the region name as an <h1>').not.toContain('Galicia');
	});

	it('/en/regions/gal: the <h1>s stay the logo and the about title', async () => {
		const html = await renderHome({ lang: 'en', path: '/en/regions/gal' });
		expect(headingTexts(html, 1).sort()).toEqual(['Asadorov', COPY.en.aboutTitle].sort());
	});
});

// FE-4 PR 3 review (WCAG 1.3.1, axe best-practice landmark-one-main / region):
// the page content sits in exactly one <main>; the mobile header and the
// desktop top bar are banners outside it.
function mainRange(html: string): { start: number; end: number } {
	const opens = [...html.matchAll(/<main\b/g)];
	expect(opens.length, `got ${opens.length} <main> elements, want 1`).toBe(1);
	const start = opens[0].index!;
	const end = html.indexOf('</main>', start);
	expect(end, 'got an unclosed <main>').toBeGreaterThan(start);
	return { start, end };
}

describe('(home) layout: one <main> landmark', { timeout: COLD_COMPILE_TIMEOUT_MS }, () => {
	for (const path of ['/en/', '/en/?tab=popular', '/en/regions/gal']) {
		it(`${path}: exactly one <main>, holding the tab panels`, async () => {
			const html = await renderHome({ lang: 'en', path });
			const { start, end } = mainRange(html);
			const panels = [...html.matchAll(/role="tabpanel"/g)].map((m) => m.index!);
			expect(panels.length, 'want both tab panels').toBe(2);
			for (const at of panels) {
				expect(at > start && at < end, 'got a tab panel outside <main>').toBe(true);
			}
		});

		it(`${path}: both headers sit outside <main>`, async () => {
			const html = await renderHome({ lang: 'en', path });
			const { start, end } = mainRange(html);
			const headers = [...html.matchAll(/<header\b/g)].map((m) => m.index!);
			expect(headers.length, 'want the mobile header and the desktop top bar').toBe(2);
			for (const at of headers) {
				expect(at < start || at > end, 'got a <header> inside <main>').toBe(true);
			}
		});
	}
});

// FE-5 PR 1, the Popular tab in the server HTML. Every URL is shareable and
// indexable (CLAUDE.md), and the filters live in the URL (D-FE5-1), so the
// server renders the filtered list itself: a reload or a shared link shows
// the same dishes before any JavaScript runs.
//
// Decisions pinned here (FE-5 PR 1):
// - Each DishCard is a link with data-testid="dish-card". FE-5 PR 3: the
//   server renders its href as the Variations page, /:lang/dishes/<key>
//   (no filters): the server can't know the width, and that link works
//   without JavaScript on both layouts and lets crawlers reach every
//   Variations page. Once hydrated, mobile switches it to the dish sheet
//   URL (?tab=popular[&f=…]&dish=<key>, D-FE5-2; see the E2E specs).
// - The result count carries data-testid="result-count" (home.dish plural);
//   the empty state is desktop.noMatch plus a "Clear all" action.
// - The Popular panel has its own <h2>, the tab label (home.popular): the
//   desktop <h1> lives in the Regional panel, which is hidden on Popular.

// From the Popular panel's start tag to the end of <main> (it is the last panel).
function popularPanel(html: string): string {
	const start = html.indexOf('id="home-popular"');
	expect(start, 'got no #home-popular panel').toBeGreaterThan(-1);
	return html.slice(start, html.indexOf('</main>', start));
}

function cardHrefs(html: string): string[] {
	return startTags(html)
		.filter((t) => t.attrs['data-testid'] === 'dish-card')
		.map((t) => decodeAmp(t.attrs.href ?? ''));
}

function resultCount(html: string): string {
	const match = /<[^>]*data-testid="result-count"[^>]*>([\s\S]*?)<\//.exec(html);
	expect(match, 'got no [data-testid="result-count"]').not.toBeNull();
	return visibleText(match![1]);
}

const ALL_DISHES = [
	'tortilla',
	'paella',
	'cocido',
	'gazpacho',
	'croquetas',
	'torrijas',
	'arrozleche'
];

describe(
	'(home) layout: the Popular list in the server HTML',
	{ timeout: COLD_COMPILE_TIMEOUT_MS },
	() => {
		it('/en/?tab=popular: every dish card, in dish order, each linking to its Variations page', async () => {
			const html = popularPanel(await renderHome({ lang: 'en', path: '/en/?tab=popular' }));
			const want = ALL_DISHES.map((key) => `/en/dishes/${key}`);
			expect(cardHrefs(html)).toEqual(want);
			expect(resultCount(html)).toBe('7 dishes');
		});

		it('/ru/?tab=popular&f=vegetarian&f=summer: only gazpacho, "1 блюдо"', async () => {
			const html = popularPanel(
				await renderHome({ lang: 'ru', path: '/ru/?tab=popular&f=vegetarian&f=summer' })
			);
			expect(cardHrefs(html)).toEqual(['/ru/dishes/gazpacho']);
			expect(resultCount(html)).toBe('1 блюдо');
			expect(visibleText(html)).toContain('Холодные супы');
		});

		it('/es/?tab=popular&f=vegetarian: three dishes, "3 platos"', async () => {
			const html = popularPanel(
				await renderHome({ lang: 'es', path: '/es/?tab=popular&f=vegetarian' })
			);
			expect(cardHrefs(html)).toEqual(
				['tortilla', 'gazpacho', 'arrozleche'].map((k) => `/es/dishes/${k}`)
			);
			expect(resultCount(html)).toBe('3 platos');
		});

		it('a messy filter URL reads canonical: order, duplicates and unknown ids', async () => {
			const path = '/en/?tab=popular&f=summer&f=bogus&f=vegetarian&f=summer';
			const html = popularPanel(await renderHome({ lang: 'en', path }));
			expect(cardHrefs(html)).toEqual(['/en/dishes/gazpacho']);
		});

		it('the Filters button counts the active filters: "Filters · 2"', async () => {
			const html = await renderHome({ lang: 'en', path: '/en/?tab=popular&f=pork&f=winter' });
			expect(visibleText(html)).toContain('Filters · 2');
		});

		it('the Filters button reads "Filters" with no filter', async () => {
			const html = await renderHome({ lang: 'en', path: '/en/?tab=popular' });
			expect(visibleText(html)).toContain('Filters');
			expect(visibleText(html)).not.toMatch(/Filters · \d/);
		});

		const empty: { lang: Lang; noMatch: string; clearAll: string; count: string }[] = [
			{
				lang: 'en',
				noMatch: 'No dishes match these filters.',
				clearAll: 'Clear all',
				count: '0 dishes'
			},
			{
				lang: 'es',
				noMatch: 'Ningún plato coincide con estos filtros.',
				clearAll: 'Borrar todo',
				count: '0 platos'
			},
			{ lang: 'ru', noMatch: 'Нет блюд по этим фильтрам.', clearAll: 'Сбросить', count: '0 блюд' }
		];
		for (const tc of empty) {
			it(`/${tc.lang}/ desserts AND summer: no cards, "${tc.noMatch}" and "${tc.clearAll}"`, async () => {
				const path = `/${tc.lang}/?tab=popular&f=desserts&f=summer`;
				const html = popularPanel(await renderHome({ lang: tc.lang, path }));
				expect(cardHrefs(html), 'got cards for a combination that matches nothing').toEqual([]);
				const text = visibleText(html);
				expect(text, `got no "${tc.noMatch}"`).toContain(tc.noMatch);
				expect(text, `got no "${tc.clearAll}"`).toContain(tc.clearAll);
				expect(resultCount(html)).toBe(tc.count);
			});
		}

		it('no empty state while dishes match', async () => {
			const html = popularPanel(await renderHome({ lang: 'en', path: '/en/?tab=popular&f=quick' }));
			expect(visibleText(html)).not.toContain('No dishes match these filters.');
		});

		it('/en/ (Regional): the Popular panel renders no dish card', async () => {
			const html = await renderHome({ lang: 'en', path: '/en/' });
			expect(cardHrefs(html), 'got dish cards on the Regional tab').toEqual([]);
		});
	}
);

describe('(home) layout: the Popular panel heading', { timeout: COLD_COMPILE_TIMEOUT_MS }, () => {
	const cases: { lang: Lang; want: string }[] = [
		{ lang: 'en', want: 'Popular' },
		{ lang: 'es', want: 'Popular' },
		{ lang: 'ru', want: 'Популярное' }
	];
	for (const tc of cases) {
		it(`/${tc.lang}/?tab=popular: the panel has an <h2> "${tc.want}"`, async () => {
			const html = popularPanel(
				await renderHome({ lang: tc.lang, path: `/${tc.lang}/?tab=popular` })
			);
			expect(headingTexts(html, 2), 'want the tab label as the panel <h2>').toContain(tc.want);
		});
	}

	// FE-5 PR 3: the desktop sidebar's "Filters" is an <h3> too, before the cards.
	it('/en/?tab=popular: the sidebar heading and the dish names are <h3>s under it', async () => {
		const html = popularPanel(await renderHome({ lang: 'en', path: '/en/?tab=popular' }));
		const h3s = [...html.matchAll(/<h3\b[^>]*>([\s\S]*?)<\/h3>/g)].map((m) =>
			decodeAmp(visibleText(m[1]))
		);
		expect(h3s).toEqual([
			'Filters',
			'Tortilla de patatas',
			'Rice dishes',
			'Cocido & stews',
			'Cold soups',
			'Croquetas',
			'Fried sweets',
			'Milk puddings'
		]);
	});
});

// FE-5 PR 2, the dish detail sheet in the server HTML (D-FE5-2:
// ?tab=popular[&f=…]&dish=<key> opens it; an unknown key opens nothing).
// The acceptance's "Back from the Variations page restores ... the open dish
// sheet" and the shareable-URL rule both need the sheet to come from the URL
// alone, so a direct load renders it open, like the region sheet.
//
// Decisions pinned here (FE-5 PR 2):
// - The dish sheet is a BottomSheet (role="dialog", data-state, named by the
//   dish) holding DishDetails (data-testid="dish-details"); a dish URL opens
//   it in peek. The server can't know the width, so it renders it as on
//   mobile; desktop ignores ?dish once hydrated (and CSS hides the sheet).
// - It lives in the Popular tab: ?dish on the Regional tab opens nothing.
// - The Filters sheet's open state is in memory (see home-popular-sheets
//   e2e), so the server always renders it closed; the Filters button
//   carries aria-haspopup="dialog" and aria-expanded="false".

type DishSheetCase = { lang: Lang; path: string; name: string };

function dishSheetTag(html: string, name: string): StartTag {
	const sheets = startTags(html).filter(
		(t) => t.attrs.role === 'dialog' && t.attrs['aria-label'] === name
	);
	expect(sheets.length, `want one dialog named "${name}"`).toBe(1);
	return sheets[0];
}

// The HTML inside the dialog named `name`.
function dishSheetHtml(html: string, name: string): string {
	const label = html.indexOf(`aria-label="${name}"`);
	expect(label, `got no dialog named "${name}"`).toBeGreaterThan(-1);
	return elementHtml(html, html.lastIndexOf('<', label));
}

const TORTILLA_REGIONS = [
	'gal',
	'ast',
	'bas',
	'cat',
	'cyl',
	'mad',
	'ara',
	'val',
	'ext',
	'clm',
	'mur',
	'and',
	'bal'
];

const TORTILLA_RU = {
	name: 'Тортилья',
	description: 'Одно блюдо — два века споров. С луком или без — это только начало.',
	count: '13 вариантов',
	seeAll: 'Все варианты',
	rows: ['По-бетансосски, жидкая внутри', 'С чорисо', 'С собрасадой'],
	regions: ['Галисия', 'Астурия', 'Балеарские острова']
};

describe(
	'(home) layout: the dish sheet in the server HTML',
	{ timeout: COLD_COMPILE_TIMEOUT_MS },
	() => {
		const open: DishSheetCase[] = [
			{ lang: 'en', path: '/en/?tab=popular&dish=tortilla', name: 'Tortilla de patatas' },
			{ lang: 'ru', path: '/ru/?tab=popular&dish=tortilla', name: 'Тортилья' },
			{ lang: 'es', path: '/es/?tab=popular&dish=paella', name: 'Arroces' },
			{
				lang: 'en',
				path: '/en/?tab=popular&f=vegetarian&dish=gazpacho',
				name: 'Cold soups'
			}
		];
		for (const tc of open) {
			it(`${tc.path}: the sheet is in peek, not inert, named "${tc.name}"`, async () => {
				const sheet = dishSheetTag(await renderHome(tc), tc.name);
				expect(sheet.attrs['data-state'], 'want the dish sheet in peek').toBe('peek');
				expect('inert' in sheet.attrs, 'got an inert dish sheet').toBe(false);
			});
		}

		it('/ru/?tab=popular&dish=tortilla: the Russian dish content is in the sheet', async () => {
			const html = await renderHome({ lang: 'ru', path: '/ru/?tab=popular&dish=tortilla' });
			const sheet = dishSheetHtml(html, TORTILLA_RU.name);
			expect(sheet, 'got no DishDetails root').toContain('data-testid="dish-details"');
			const text = visibleText(sheet);
			const wants = [
				TORTILLA_RU.description,
				TORTILLA_RU.count,
				TORTILLA_RU.seeAll,
				...TORTILLA_RU.rows,
				...TORTILLA_RU.regions
			];
			for (const want of wants) expect(text, `got no "${want}" in the sheet`).toContain(want);
		});

		it('/ru/?tab=popular&dish=tortilla: rows link to each recipe in region order, then See all', async () => {
			const html = await renderHome({ lang: 'ru', path: '/ru/?tab=popular&dish=tortilla' });
			const hrefs = startTags(dishSheetHtml(html, TORTILLA_RU.name))
				.map((t) => t.attrs.href ?? '')
				.filter((href) => href.startsWith('/ru/dishes/tortilla'));
			const rows = TORTILLA_REGIONS.map((region) => `/ru/dishes/tortilla/${region}`);
			expect(hrefs).toEqual([...rows, '/ru/dishes/tortilla']);
		});

		it('/en/?tab=popular&dish=bogus: an unknown key opens nothing', async () => {
			const html = await renderHome({ lang: 'en', path: '/en/?tab=popular&dish=bogus' });
			expect(openDialogs(html), 'got a sheet open for an unknown dish').toEqual([]);
			expect(cardHrefs(popularPanel(html)).length, 'want the full list still').toBe(7);
		});

		it('/en/?dish=tortilla (Regional): the dish sheet stays closed', async () => {
			const html = await renderHome({ lang: 'en', path: '/en/?dish=tortilla' });
			expect(openDialogs(html), 'got a sheet open on the Regional tab').toEqual([]);
		});

		it('/en/?tab=popular: no dish, no open dish sheet', async () => {
			const html = await renderHome({ lang: 'en', path: '/en/?tab=popular' });
			expect(html).not.toContain('data-testid="dish-details"');
		});

		it('/en/?tab=popular&f=vegetarian&dish=tortilla: the tabs still lead to bare tab URLs', async () => {
			const tabs = tabsIn(
				await renderHome({ lang: 'en', path: '/en/?tab=popular&f=vegetarian&dish=tortilla' })
			);
			const hrefs = new Set(tabs.map((t) => t.href));
			expect([...hrefs].sort()).toEqual(['/en/', '/en/?tab=popular']);
		});
	}
);

describe(
	'(home) layout: the Filters button in the server HTML',
	{ timeout: COLD_COMPILE_TIMEOUT_MS },
	() => {
		// The <button> whose text is "Filters" or "Filters · N".
		function filtersButtonTag(html: string): StartTag {
			const buttons = html.match(/<button\b[^>]*>[\s\S]*?<\/button>/g) ?? [];
			const found = buttons.find((b) => /^Filters( · \d+)?$/.test(visibleText(b)));
			expect(found, 'got no Filters button').toBeDefined();
			return startTags(found!)[0];
		}

		for (const path of ['/en/?tab=popular', '/en/?tab=popular&f=vegetarian&dish=tortilla']) {
			it(`${path}: aria-haspopup="dialog", aria-expanded="false" (closed on load)`, async () => {
				const button = filtersButtonTag(await renderHome({ lang: 'en', path }));
				expect(button.attrs['aria-haspopup']).toBe('dialog');
				expect(button.attrs['aria-expanded']).toBe('false');
			});
		}

		it('/en/?tab=popular: the Filters sheet is not open on load', async () => {
			const html = await renderHome({ lang: 'en', path: '/en/?tab=popular' });
			const filters = startTags(html).filter(
				(t) => t.attrs.role === 'dialog' && t.attrs['aria-label'] === 'Filters'
			);
			for (const sheet of filters) expect('inert' in sheet.attrs, 'want it inert').toBe(true);
		});
	}
);

// FE-5 PR 3, the desktop filter sidebar in the server HTML (stage FE-5 ->
// Desktop Popular; desktop README -> Popular; prototype L137–154). Both
// layouts are in the HTML (CSS hides one), so the sidebar is rendered for
// every Popular URL, with the URL's filters pressed.
//
// Decisions pinned here (FE-5 PR 3):
// - The sidebar root is data-testid="filter-sidebar", a <section>
//   aria-labelledby its <h3> "Filters", holding FilterGroups and a "Clear
//   all" <button>, aria-disabled="true" when no filter is active (it is
//   drawn at 40% opacity then; see home-popular-desktop.e2e.ts).
// - The mobile Filters sheet's FilterGroups may be in the page too, so
//   every id in the HTML is unique and every id reference resolves.

const SIDEBAR_CHIPS_EN = [
	'Vegetarian',
	'Seafood',
	'With pork',
	'Tapas',
	'Mains',
	'Desserts',
	'Quick',
	'Slow-cooked',
	'Summer',
	'Winter',
	'Holy Week',
	'All year'
];

function sidebarHtml(html: string): string {
	const marker = html.indexOf('data-testid="filter-sidebar"');
	expect(marker, 'got no [data-testid="filter-sidebar"]').toBeGreaterThan(-1);
	return elementHtml(html, html.lastIndexOf('<', marker));
}

type ButtonTag = { text: string; attrs: Record<string, string> };

function buttonsIn(html: string): ButtonTag[] {
	const buttons = html.match(/<button\b[^>]*>[\s\S]*?<\/button>/g) ?? [];
	return buttons.map((b) => ({ text: decodeAmp(visibleText(b)), attrs: startTags(b)[0].attrs }));
}

describe(
	'(home) layout: the desktop filter sidebar in the server HTML',
	{ timeout: COLD_COMPILE_TIMEOUT_MS },
	() => {
		it('/en/?tab=popular: a <section> labelled by its <h3> "Filters"', async () => {
			const html = popularPanel(await renderHome({ lang: 'en', path: '/en/?tab=popular' }));
			const sidebar = sidebarHtml(html);
			const root = startTags(sidebar)[0];
			expect(root.name, 'want the sidebar to be a <section>').toBe('section');
			const heading = /<h3\b([^>]*)>([\s\S]*?)<\/h3>/.exec(sidebar);
			expect(heading, 'got no <h3> in the sidebar').not.toBeNull();
			expect(visibleText(heading![2])).toBe('Filters');
			const headingId = /\bid="([^"]+)"/.exec(heading![1])?.[1];
			expect(headingId, 'want an id on the sidebar heading').toBeDefined();
			expect(root.attrs['aria-labelledby']).toBe(headingId);
		});

		it('/en/?tab=popular: the twelve chips in group order, none pressed; Clear all aria-disabled', async () => {
			const html = popularPanel(await renderHome({ lang: 'en', path: '/en/?tab=popular' }));
			const buttons = buttonsIn(sidebarHtml(html));
			const chips = buttons.filter((b) => 'aria-pressed' in b.attrs);
			expect(chips.map((c) => c.text)).toEqual(SIDEBAR_CHIPS_EN);
			expect(chips.filter((c) => c.attrs['aria-pressed'] === 'true')).toEqual([]);
			const clear = buttons.find((b) => b.text === 'Clear all');
			expect(clear, 'got no "Clear all" button in the sidebar').toBeDefined();
			expect(clear!.attrs['aria-disabled']).toBe('true');
		});

		it('/ru/?tab=popular&f=pork&f=winter: those chips pressed; Clear all enabled', async () => {
			const path = '/ru/?tab=popular&f=pork&f=winter';
			const html = popularPanel(await renderHome({ lang: 'ru', path }));
			const buttons = buttonsIn(sidebarHtml(html));
			const pressed = buttons.filter((b) => b.attrs['aria-pressed'] === 'true').map((b) => b.text);
			expect(pressed).toEqual(['Со свининой', 'Зима']);
			const clear = buttons.find((b) => b.text === 'Сбросить');
			expect(clear, 'got no "Сбросить" button in the sidebar').toBeDefined();
			expect(clear!.attrs['aria-disabled'] ?? 'false').toBe('false');
			expect('disabled' in clear!.attrs, 'want it enabled').toBe(false);
		});

		it('/es/?tab=popular: the sidebar heading reads "Filtros"', async () => {
			const html = popularPanel(await renderHome({ lang: 'es', path: '/es/?tab=popular' }));
			expect(headingTexts(sidebarHtml(html), 3)).toEqual(['Filtros']);
		});

		it('/en/ (Regional): no sidebar', async () => {
			const html = await renderHome({ lang: 'en', path: '/en/' });
			expect(html).not.toContain('data-testid="filter-sidebar"');
		});
	}
);

const ID_REFERENCES = ['aria-labelledby', 'aria-describedby', 'aria-controls', 'for'];

function duplicateIds(html: string): string[] {
	const ids = startTags(html)
		.map((t) => t.attrs.id)
		.filter((id): id is string => id !== undefined);
	return [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
}

function danglingReferences(html: string): string[] {
	const tags = startTags(html);
	const ids = new Set(tags.map((t) => t.attrs.id).filter(Boolean));
	return tags.flatMap((t) =>
		ID_REFERENCES.flatMap((attr) =>
			(t.attrs[attr] ?? '')
				.split(/\s+/)
				.filter((ref) => ref !== '' && !ids.has(ref))
				.map((ref) => `${attr}="${ref}" on <${t.name}>`)
		)
	);
}

describe('(home) layout: ids in the server HTML', { timeout: COLD_COMPILE_TIMEOUT_MS }, () => {
	const paths = [
		'/en/?tab=popular',
		'/ru/?tab=popular&f=vegetarian&f=quick',
		'/en/?tab=popular&f=desserts&f=summer',
		'/en/?tab=popular&dish=tortilla'
	];
	for (const path of paths) {
		it(`${path}: every id is unique`, async () => {
			const html = await renderHome({ lang: path.slice(1, 3) as Lang, path });
			expect(duplicateIds(html), 'got duplicate ids').toEqual([]);
		});

		it(`${path}: every id reference resolves`, async () => {
			const html = await renderHome({ lang: path.slice(1, 3) as Lang, path });
			expect(danglingReferences(html), 'got references to missing ids').toEqual([]);
		});
	}
});

// FE-7 PR 2 review: the search overlay needs JavaScript, so it is mounted
// only once hydrated and the server HTML has no search dialog: the region
// sheet stays the one dialog on the bare home. The one combobox in the server
// HTML is the desktop field, disabled until hydration enables it.
describe(
	'(home) layout: no search dialog in the server HTML',
	{ timeout: COLD_COMPILE_TIMEOUT_MS },
	() => {
		const paths: { lang: Lang; path: string }[] = [
			{ lang: 'en', path: '/en/' },
			{ lang: 'en', path: '/en/?tab=popular' },
			{ lang: 'ru', path: '/ru/' }
		];
		for (const { lang, path } of paths) {
			it(`${path}: no dialog named "${COPY[lang].search}"; one disabled combobox`, async () => {
				const tags = startTags(await renderHome({ lang, path }));
				const search = tags.filter(
					(t) => t.attrs.role === 'dialog' && t.attrs['aria-label'] === COPY[lang].search
				);
				expect(search.length, 'got a search dialog in the server HTML').toBe(0);
				const comboboxes = tags.filter((t) => t.attrs.role === 'combobox');
				expect(comboboxes.length, 'want only the desktop field as a combobox').toBe(1);
				expect(comboboxes[0].attrs, 'want the server-rendered field disabled').toHaveProperty(
					'disabled'
				);
			});
		}

		it('/en/: the region sheet is the only dialog', async () => {
			const tags = startTags(await renderHome({ lang: 'en', path: '/en/' }));
			const dialogs = tags.filter((t) => t.attrs.role === 'dialog');
			expect(dialogs.map((t) => t.attrs['data-state'])).toEqual(['hidden']);
		});
	}
);
