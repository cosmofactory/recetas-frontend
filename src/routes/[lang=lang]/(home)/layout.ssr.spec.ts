import { createRawSnippet, type Component, type Snippet } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import bundle from '#lib/server/mock/content.bundle.json';
import { buildView } from '#lib/server/mock/bundle-mapping.ts';
import { loadExport } from '../../../testutil/load-export';
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

// The text a reader sees: no tags, no hydration comments, collapsed spaces.
function visibleText(html: string): string {
	return html
		.replace(/<!--[\s\S]*?-->/g, '')
		.replace(/<[^>]+>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

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
