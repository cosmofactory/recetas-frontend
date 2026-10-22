import { afterEach, describe, expect, it } from 'vitest';
import bundle from '#lib/server/mock/content.bundle.json';
import { buildView } from '#lib/server/mock/bundle-mapping.ts';
import type { Dish, Photos } from '#lib/server/catalog-source.ts';
import {
	decodeAmp,
	elementsWith,
	headingTexts,
	metaContents,
	startTags,
	visibleText
} from '../../../../testutil/html';
import type { Lang } from '../../../../testutil/map';
import { VARIATION_REGIONS } from '../../../../testutil/popular-copy';
import {
	breadcrumbItems,
	jsonLdDocuments,
	jsonLdScripts,
	nodesOfType,
	onlyNodeOfType,
	type JsonLdNode
} from '../../../../testutil/json-ld';
import { renderKitPage, unmockKit } from '../../../../testutil/ssr-page';
import {
	backFallback,
	PAGE_COPY,
	recipePath,
	TORTILLA_PAGE,
	VARIATION_CARD_TEST_ID,
	VARIATION_PLURALS,
	VARIATIONS_LOCALES
} from '../../../../testutil/variations-copy';

// FE-6 PR 2, the mobile Variations page (4a) rendered on the server
// (svelte/server). Mobile README -> Screen 2: sticky top bar (back button,
// dish name), header (hero photo 180px; dish name + "N variations"; the
// description), then one card per variation (130px photo, region eyebrow,
// name, description, "View recipe →"), the whole card tappable to the
// Recipe page, and no map. CLAUDE.md: all variations are equal, in region
// order, none highlighted. Every URL is indexable and the acceptance checks
// the page with JavaScript disabled, so all of it must be in the server HTML.
//
// Decisions pinned here (FE-6 PR 2):
// - The dish name is the page's one <h1>.
// - Each card is ONE <a data-testid="variation-card"> to
//   /:lang/dishes/:dishKey/:regionKey with no link nested inside it.
// - The hero is the dish's `hero` photo, eager with fetchpriority="high"
//   (above the fold); each card's photo is its variation's `card` photo,
//   lazy.
// - The back link's SSR href is the direct-entry fallback
//   /:lang/?tab=popular&dish=<key> (stage FE-6 -> Small decisions), named
//   by a11y.back.

type PageData = {
	origin: string;
	mediaBaseUrl: string | undefined;
	regions: unknown[];
	dishes: Dish[];
	dish: Dish;
};

const PAGE = 'src/routes/[lang=lang]/dishes/[dishKey]/+page.svelte';
const ORIGIN = 'http://localhost';
const MEDIA_BASE_URL = 'https://media.example.test';
const ROUTE_ID = '/[lang=lang]/dishes/[dishKey]';

type RenderSpec = { lang: Lang; dishKey?: string; variationCount?: number; withPhotos?: boolean };

const photos = (prefix: string): Photos => ({
	thumb: `${prefix}/thumb-1a2b`,
	card: `${prefix}/card-1a2b`,
	hero: `${prefix}/hero-1a2b`
});

function withPhotos(dish: Dish): Dish {
	return {
		...dish,
		photos: photos(`dishes/${dish.key}`),
		variations: dish.variations.map((v) => ({
			...v,
			photos: photos(`dishes/${dish.key}/${v.regionKey}`)
		}))
	};
}

function fixtureDish(spec: RenderSpec): Dish {
	const view = buildView(bundle, spec.lang);
	const dish = view.dishesByKey.get(spec.dishKey ?? 'tortilla');
	if (!dish) throw new Error(`no fixture dish ${spec.dishKey}`);
	const sliced = { ...dish, variations: dish.variations.slice(0, spec.variationCount) };
	return spec.withPhotos ? withPhotos(sliced) : sliced;
}

function pageData(spec: RenderSpec): PageData {
	const view = buildView(bundle, spec.lang);
	return {
		origin: ORIGIN,
		mediaBaseUrl: spec.withPhotos ? MEDIA_BASE_URL : undefined,
		regions: view.regions,
		dishes: view.dishes,
		dish: fixtureDish(spec)
	};
}

function renderPage(spec: RenderSpec): Promise<{ head: string; body: string }> {
	const data = pageData(spec);
	return renderKitPage({
		pageFile: PAGE,
		routeId: ROUTE_ID,
		lang: spec.lang,
		url: `/${spec.lang}/dishes/${data.dish.key}`,
		params: { lang: spec.lang, dishKey: data.dish.key },
		data
	});
}

afterEach(unmockKit);

const cardsIn = (html: string) => elementsWith(html, `data-testid="${VARIATION_CARD_TEST_ID}"`);

function cardHrefs(html: string): string[] {
	return cardsIn(html).map((card) => decodeAmp(startTags(card)[0].attrs.href ?? ''));
}

const LANGUAGE_MENU_IDS = ['language-menu-desktop', 'language-menu-mobile'];

// The body with each language menu element cut out (its current-language
// row legitimately carries aria-current).
function withoutLanguageMenus(html: string): string {
	let rest = html;
	for (const id of LANGUAGE_MENU_IDS) {
		for (const menu of elementsWith(rest, ` id="${id}"`)) rest = rest.replace(menu, '');
	}
	return rest;
}

function linkTags(html: string) {
	return startTags(html).filter((t) => t.name === 'a');
}

function imgSrcs(html: string): { src: string; attrs: Record<string, string> }[] {
	return startTags(html)
		.filter((t) => t.name === 'img')
		.map((t) => ({ src: t.attrs.src ?? '', attrs: t.attrs }));
}

// The first compile of the page and its components can pass Vitest's 5s
// default under a full parallel run.
const COLD_COMPILE_TIMEOUT_MS = 30_000;

describe('Variations page: header', { timeout: COLD_COMPILE_TIMEOUT_MS }, () => {
	for (const lang of VARIATIONS_LOCALES) {
		const copy = TORTILLA_PAGE[lang];

		it(`${lang}: the dish name is the one <h1>: "${copy.name}"`, async () => {
			const { body } = await renderPage({ lang });
			expect(headingTexts(body, 1)).toEqual([copy.name]);
		});

		it(`${lang}: shows "${copy.count}" and the dish description`, async () => {
			const text = visibleText((await renderPage({ lang })).body);
			expect(text, `got no "${copy.count}"`).toContain(copy.count);
			expect(text, `got no description "${copy.description}"`).toContain(copy.description);
		});
	}

	for (const tc of VARIATION_PLURALS) {
		it(`${tc.lang}: ${tc.count} variations read "${tc.want}"`, async () => {
			const text = visibleText(
				(await renderPage({ lang: tc.lang, variationCount: tc.count })).body
			);
			expect(text, `got no "${tc.want}" in: ${text.slice(0, 300)}`).toContain(tc.want);
		});
	}

	it('order: hero photo, then the <h1>, then the description, then the first card', async () => {
		const { body } = await renderPage({ lang: 'en', withPhotos: true });
		const hero = body.indexOf('dishes/tortilla/hero-1a2b');
		const h1 = body.indexOf('<h1');
		const description = body.indexOf(TORTILLA_PAGE.en.description);
		const firstCard = body.indexOf(`data-testid="${VARIATION_CARD_TEST_ID}"`);
		expect(hero, 'got no hero photo').toBeGreaterThan(-1);
		expect([hero < h1, h1 < description, description < firstCard]).toEqual([true, true, true]);
	});

	it('the hero is the dish hero photo, eager with fetchpriority="high"', async () => {
		const { body } = await renderPage({ lang: 'en', withPhotos: true });
		const heroes = imgSrcs(body).filter((img) => img.src.includes('dishes/tortilla/hero-1a2b'));
		expect(heroes.length, 'want one hero <img>').toBe(1);
		expect(heroes[0].attrs.loading).toBe('eager');
		expect(heroes[0].attrs.fetchpriority).toBe('high');
	});
});

describe('Variations page: variation cards', { timeout: COLD_COMPILE_TIMEOUT_MS }, () => {
	for (const lang of VARIATIONS_LOCALES) {
		it(`${lang}: one card per variation, in region order, each to its recipe`, async () => {
			const { body } = await renderPage({ lang });
			const want = VARIATION_REGIONS.tortilla.map((r) => recipePath(lang, 'tortilla', r));
			expect(cardHrefs(body)).toEqual(want);
		});

		it(`${lang}: a card shows region, name, description and "${PAGE_COPY[lang].viewRecipe}"`, async () => {
			const cards = cardsIn((await renderPage({ lang })).body);
			for (const [i, want] of TORTILLA_PAGE[lang].cards.entries()) {
				const text = decodeAmp(visibleText(cards[i] ?? ''));
				for (const part of [want.region, want.name, want.description, PAGE_COPY[lang].viewRecipe]) {
					expect(text, `got no "${part}" in card ${i}: "${text}"`).toContain(part);
				}
			}
		});
	}

	it('paella keeps the API (region) order: cat, ara, val, …', async () => {
		const { body } = await renderPage({ lang: 'en', dishKey: 'paella' });
		const want = VARIATION_REGIONS.paella.map((r) => recipePath('en', 'paella', r));
		expect(cardHrefs(body)).toEqual(want);
	});

	it('each card is one <a> with no link inside it', async () => {
		const cards = cardsIn((await renderPage({ lang: 'en' })).body);
		expect(cards.length, 'got no variation cards').toBe(VARIATION_REGIONS.tortilla.length);
		for (const card of cards) {
			const links = linkTags(card);
			expect(links.length, `got ${links.length} links in one card`).toBe(1);
		}
	});

	it('no other link on the page leads to a recipe (the card is the only one)', async () => {
		const { body } = await renderPage({ lang: 'en' });
		const recipeLinks = linkTags(body)
			.map((t) => t.attrs.href ?? '')
			.filter((href) => /^\/en\/dishes\/tortilla\/[a-z]+$/.test(href));
		expect(recipeLinks.length).toBe(VARIATION_REGIONS.tortilla.length);
	});

	it('every card has its variation card photo, loaded lazily', async () => {
		const cards = cardsIn((await renderPage({ lang: 'en', withPhotos: true })).body);
		for (const [i, region] of VARIATION_REGIONS.tortilla.entries()) {
			const imgs = imgSrcs(cards[i] ?? '');
			const prefix = `dishes/tortilla/${region}/card-1a2b`;
			expect(imgs.map((img) => img.src).some((src) => src.includes(prefix))).toBe(true);
			for (const img of imgs) expect(img.attrs.loading, `card ${region}`).toBe('lazy');
		}
	});
});

describe(
	'Variations page: all variations equal, no map',
	{ timeout: COLD_COMPILE_TIMEOUT_MS },
	() => {
		it('every card has the same markup apart from its href', async () => {
			const cards = cardsIn((await renderPage({ lang: 'en' })).body);
			const shapes = cards.map((card) => {
				const { href, ...rest } = startTags(card)[0].attrs;
				return JSON.stringify(rest) + (href ? '' : ' (no href)');
			});
			expect(new Set(shapes).size, `got differing cards: ${[...new Set(shapes)].join(' | ')}`).toBe(
				1
			);
		});

		it('marks no card as current, best, primary or featured', async () => {
			// aria-current is scoped to the cards: the language menu in the top
			// bar legitimately marks the current language with it.
			const { body } = await renderPage({ lang: 'en' });
			const cards = cardsIn(body);
			expect(cards.length, 'got no variation cards').toBeGreaterThan(0);
			for (const [i, card] of cards.entries()) {
				expect(card, `got a highlight on card ${i}`).not.toMatch(
					/aria-current=|\b(best|primary|featured|highlight)\b/i
				);
			}
			expect(body).not.toMatch(/\b(best|primary|featured|highlight)\b/i);
		});

		it('has no aria-current anywhere outside the language menu', async () => {
			// Catches a highlight on a wrapper around the cards, not only on a card.
			const rest = withoutLanguageMenus((await renderPage({ lang: 'en' })).body);
			const marked = startTags(rest).filter((t) => 'aria-current' in t.attrs);
			expect(
				marked.map((t) => `<${t.name}>`),
				'got aria-current outside the menu'
			).toEqual([]);
		});

		it('renders no map', async () => {
			const { body } = await renderPage({ lang: 'en' });
			expect(body, 'got the region map').not.toContain('data-testid="region-map"');
			expect(body, 'got map cells').not.toContain('data-map-cell');
		});
	}
);

describe('Variations page: sticky top bar', { timeout: COLD_COMPILE_TIMEOUT_MS }, () => {
	for (const lang of VARIATIONS_LOCALES) {
		const want = backFallback(lang, 'tortilla');

		it(`${lang}: the back link goes to ${want}, named "${PAGE_COPY[lang].back}"`, async () => {
			const { body } = await renderPage({ lang });
			const back = linkTags(body).filter((t) => t.attrs['aria-label'] === PAGE_COPY[lang].back);
			expect(back.length, `want one link named "${PAGE_COPY[lang].back}"`).toBe(1);
			expect(decodeAmp(back[0].attrs.href ?? '')).toBe(want);
		});
	}

	it('paella: the fallback carries its own key', async () => {
		const { body } = await renderPage({ lang: 'en', dishKey: 'paella' });
		const back = linkTags(body).find((t) => t.attrs['aria-label'] === PAGE_COPY.en.back);
		expect(decodeAmp(back?.attrs.href ?? '')).toBe(backFallback('en', 'paella'));
	});
});

describe('Variations page: head', { timeout: COLD_COMPILE_TIMEOUT_MS }, () => {
	for (const lang of VARIATIONS_LOCALES) {
		const copy = TORTILLA_PAGE[lang];

		it(`${lang}: <title>Asadorov · ${copy.name}</title> and the dish description`, async () => {
			const { head } = await renderPage({ lang });
			expect(head).toContain(`<title>Asadorov · ${copy.name}</title>`);
			const meta = startTags(head).filter(
				(t) => t.name === 'meta' && t.attrs.name === 'description'
			);
			expect(meta.map((t) => t.attrs.content)).toEqual([copy.description]);
		});
	}
});

// FE-8 PR 1 (stage FE-8 -> SEO, meta tags: "an OG image from the hero photo
// or a static fallback"): the page's head carries og:image, the dish's hero as
// its largest JPEG on the media origin (og-image.spec.ts), else the static
// fallback on the page's origin (data.origin, PUBLIC_ORIGIN).
describe('Variations page og:image (FE-8)', () => {
	it("is the dish's hero photo when there is one", async () => {
		const { head } = await renderPage({ lang: 'en', withPhotos: true });
		const want = `${MEDIA_BASE_URL}/dishes/tortilla/hero-1a2b-1600w.jpg`;
		expect(metaContents(head, 'og:image'), `want og:image ${want}`).toEqual([want]);
	});

	it('is the static fallback without photos', async () => {
		const { head } = await renderPage({ lang: 'es' });
		const want = `${ORIGIN}/og-default.png`;
		expect(metaContents(head, 'og:image'), `want og:image ${want}`).toEqual([want]);
	});
});

// FE-8 PR 2 (stage FE-8 -> SEO: "ItemList or BreadcrumbList markup on the
// Variations pages"): both, in the head as <script type="application/ld+json">
// (same serialiser as the Recipe page, json-ld.spec.ts), each document with
// @context https://schema.org.
// - BreadcrumbList Home → dish: "Asadorov" (the brand, untranslated) at
//   /:lang/, then the dish name at this page's canonical; `item` absolute.
// - ItemList of the variations' Recipe pages in the API's region order (all
//   equal, none first by merit): ListItem { position from 1, url (absolute
//   canonical of the Recipe page), name (the variation name) }.
// - No Recipe node here: the recipes are on their own pages.
type ListEntry = { position: number; url: string; name: string };

function itemListEntries(list: JsonLdNode): ListEntry[] {
	return ((list.itemListElement ?? []) as JsonLdNode[]).map((entry) => ({
		position: entry.position as number,
		url: entry.url as string,
		name: entry.name as string
	}));
}

function wantEntries(lang: Lang, dishKey: string): ListEntry[] {
	return fixtureDish({ lang, dishKey }).variations.map((v, i) => ({
		position: i + 1,
		url: `${ORIGIN}${recipePath(lang, dishKey, v.regionKey)}`,
		name: v.name
	}));
}

describe('Variations page JSON-LD (FE-8)', { timeout: COLD_COMPILE_TIMEOUT_MS }, () => {
	for (const lang of VARIATIONS_LOCALES) {
		it(`${lang}: a BreadcrumbList Home → dish`, async () => {
			const list = onlyNodeOfType((await renderPage({ lang })).head, 'BreadcrumbList');
			expect(breadcrumbItems(list)).toEqual([
				{ position: 1, name: 'Asadorov', item: `${ORIGIN}/${lang}/` },
				{ position: 2, name: TORTILLA_PAGE[lang].name, item: `${ORIGIN}/${lang}/dishes/tortilla` }
			]);
		});

		it(`${lang}: an ItemList of every variation's recipe URL, in region order`, async () => {
			const list = onlyNodeOfType((await renderPage({ lang })).head, 'ItemList');
			expect(itemListEntries(list)).toEqual(wantEntries(lang, 'tortilla'));
		});
	}

	it('every ItemList entry is a ListItem', async () => {
		const list = onlyNodeOfType((await renderPage({ lang: 'en' })).head, 'ItemList');
		const types = ((list.itemListElement ?? []) as JsonLdNode[]).map((e) => e['@type']);
		expect(types.length, 'got an empty ItemList').toBe(VARIATION_REGIONS.tortilla.length);
		expect(new Set(types)).toEqual(new Set(['ListItem']));
	});

	it('paella: the ItemList keeps the API (region) order: cat, ara, val, …', async () => {
		const { head } = await renderPage({ lang: 'en', dishKey: 'paella' });
		const urls = itemListEntries(onlyNodeOfType(head, 'ItemList')).map((e) => e.url);
		const want = VARIATION_REGIONS.paella.map((r) => `${ORIGIN}${recipePath('en', 'paella', r)}`);
		expect(urls).toEqual(want);
	});

	it('the ItemList URLs are the variation cards’ links, made absolute', async () => {
		const { head, body } = await renderPage({ lang: 'ru' });
		const urls = itemListEntries(onlyNodeOfType(head, 'ItemList')).map((e) => e.url);
		expect(urls).toEqual(cardHrefs(body).map((href) => `${ORIGIN}${href}`));
	});

	it('every JSON-LD document names the schema.org context', async () => {
		const docs = jsonLdDocuments((await renderPage({ lang: 'es' })).head);
		expect(docs.length, 'got no JSON-LD in the head').toBeGreaterThan(0);
		for (const doc of docs) expect(doc['@context']).toBe('https://schema.org');
	});

	it('is in the head, never the body, and has no Recipe node', async () => {
		const { head, body } = await renderPage({ lang: 'en' });
		expect(jsonLdScripts(head).length, 'got no JSON-LD in the head').toBeGreaterThan(0);
		expect(jsonLdScripts(body)).toEqual([]);
		expect(nodesOfType(head, 'Recipe')).toEqual([]);
	});
});
