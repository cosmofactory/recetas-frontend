import { afterEach, describe, expect, it } from 'vitest';
import bundle from '#lib/server/mock/content.bundle.json';
import { buildView } from '#lib/server/mock/bundle-mapping.ts';
import {
	decodeAmp,
	elementsWith,
	headingTexts,
	startTags,
	visibleText
} from '../../../../../../testutil/html';
import { breadcrumbItems, onlyNodeOfType } from '../../../../../../testutil/json-ld';
import { spainWideRecipeIn, type Recipe } from '../../../../../../testutil/recipe';
import {
	RECIPE_COPY,
	RECIPE_TEST_IDS,
	type RecipeLocale
} from '../../../../../../testutil/recipe-copy';
import { renderKitPage, unmockKit } from '../../../../../../testutil/ssr-page';
import {
	ALLIOLI,
	ARROZ_BLANCO,
	ARROZ_BLANCO_FIRST_STEP,
	SPAIN_WIDE_LABEL,
	SPAIN_WIDE_LOCALES,
	spainWideRecipePath
} from '../../../../../../testutil/spain-wide';
import { PAGE_COPY, pageTitle } from '../../../../../../testutil/variations-copy';

// FE-11, the Recipe page of a Spanish (Spain-wide) variation at
// /:lang/dishes/:dishKey/esp/:variationSlug, rendered on the server
// (svelte/server), like the regional Recipe page (FE-6 PR 3, whose spec pins
// the shared layout). Sources: both READMEs -> routes and "Spanish
// (Spain-wide) variations (2026-11-23)"; stage FE-11.
//
// Decisions pinned here:
// - The page is src/routes/[lang=lang]/dishes/[dishKey]/esp/[variationSlug]/
//   +page.svelte, fed `{ recipe }` by its loader plus the [lang=lang]
//   layout's lists, like the regional page.
// - The region-slot rule: the eyebrow (the region only on a regional
//   recipe) is spainWide.label, "Spanish" / "España" / "Испания", upper-cased
//   by CSS only. Assumption: the README's example "Spanish · Allioli" reads
//   the eyebrow as "{region} · {dish}", which the FE-9 D-FE9-6 eyebrow no
//   longer is; "in its place, and nowhere else" keeps it the label alone.
// - The <h1> and <title> follow variationTitle (D-FE9-6) as everywhere.
// - Back, on a direct load (the SSR render): a dish with two or more
//   variations goes to its Variations page (the mobile bar's back link and
//   the desktop pill, which names the dish); a dish with exactly one
//   variation has no Variations page, so both go to Popular,
//   /:lang/?tab=popular, and the pill reads "Popular".
// - The breadcrumb never links the redirected dish URL of a one-variation dish.

type PageData = {
	origin: string;
	mediaBaseUrl: string | undefined;
	regions: unknown[];
	dishes: unknown[];
	recipe: Recipe;
};

const PAGE = 'src/routes/[lang=lang]/dishes/[dishKey]/esp/[variationSlug]/+page.svelte';
const ROUTE_ID = '/[lang=lang]/dishes/[dishKey]/esp/[variationSlug]';
const ORIGIN = 'http://localhost';
const POPULAR_LABEL: Record<RecipeLocale, string> = {
	en: 'Popular',
	es: 'Popular',
	ru: 'Популярное'
};

type RenderSpec = { lang: RecipeLocale; dishKey: string; slug: string };

const MORTER: Omit<RenderSpec, 'lang'> = { dishKey: ALLIOLI.key, slug: ALLIOLI.variations[0].slug };
const ARROZ: Omit<RenderSpec, 'lang'> = {
	dishKey: ARROZ_BLANCO.key,
	slug: ARROZ_BLANCO.variations[0].slug
};

function pageData(spec: RenderSpec): PageData {
	const view = buildView(bundle, spec.lang);
	return {
		origin: ORIGIN,
		mediaBaseUrl: undefined,
		regions: view.regions,
		dishes: view.dishes,
		recipe: spainWideRecipeIn(spec.lang, spec.dishKey, spec.slug)
	};
}

function renderPage(spec: RenderSpec) {
	const { lang, dishKey, slug } = spec;
	return renderKitPage({
		pageFile: PAGE,
		routeId: ROUTE_ID,
		lang,
		url: spainWideRecipePath(lang, dishKey, slug),
		params: { lang, dishKey, variationSlug: slug },
		data: pageData(spec)
	});
}

afterEach(unmockKit);

function textOf(html: string, testId: string): string {
	const found = elementsWith(html, `data-testid="${testId}"`);
	expect(found.length, `got ${found.length} data-testid="${testId}", want 1`).toBe(1);
	return decodeAmp(visibleText(found[0]));
}

function backLinkHref(html: string, lang: RecipeLocale): string {
	const back = startTags(html).filter(
		(t) => t.name === 'a' && t.attrs['aria-label'] === PAGE_COPY[lang].back
	);
	expect(back.length, `want one link named "${PAGE_COPY[lang].back}"`).toBe(1);
	return decodeAmp(back[0].attrs.href ?? '');
}

function pill(html: string): { label: string; href: string } {
	const found = elementsWith(html, 'data-testid="back-pill"');
	expect(found.length, 'want one back pill').toBe(1);
	const href = decodeAmp(startTags(found[0])[0].attrs.href ?? '');
	return { label: decodeAmp(visibleText(found[0])).trim(), href };
}

// The first compile of the page and its components can pass Vitest's 5s
// default under a full parallel run.
const COLD_COMPILE_TIMEOUT_MS = 30_000;

describe('Spanish recipe page: header (FE-11)', { timeout: COLD_COMPILE_TIMEOUT_MS }, () => {
	for (const lang of SPAIN_WIDE_LOCALES) {
		it(`${lang}: the eyebrow is "${SPAIN_WIDE_LABEL[lang]}"`, async () => {
			const { body } = await renderPage({ lang, ...MORTER });
			expect(textOf(body, RECIPE_TEST_IDS.eyebrow)).toBe(SPAIN_WIDE_LABEL[lang]);
		});
	}

	it('en: "Allioli de morter" (it starts with its dish) is the one <h1> and the <title>', async () => {
		const { head, body } = await renderPage({ lang: 'en', ...MORTER });
		expect(headingTexts(body, 1)).toEqual(['Allioli de morter']);
		expect(head).toContain(`<title>${pageTitle('Allioli de morter')}</title>`);
	});

	it('ru: the <h1> names the dish, "Альиоли · Allioli de morter"', async () => {
		const { body } = await renderPage({ lang: 'ru', ...MORTER });
		expect(headingTexts(body, 1)).toEqual(['Альиоли · Allioli de morter']);
	});

	it('en: the whole recipe is in the server HTML (ingredients, method, first step)', async () => {
		const { body } = await renderPage({ lang: 'en', ...ARROZ });
		expect(headingTexts(body, 2)).toEqual([RECIPE_COPY.en.ingredients, RECIPE_COPY.en.method]);
		expect(decodeAmp(visibleText(body))).toContain(ARROZ_BLANCO_FIRST_STEP);
		expect(elementsWith(body, `data-testid="${RECIPE_TEST_IDS.ingredient}"`).length).toBe(6);
	});

	it('never shows "null" where the region would be', async () => {
		const text = decodeAmp(visibleText((await renderPage({ lang: 'es', ...MORTER })).body));
		expect(text).not.toMatch(/\bnull\b|undefined/);
	});

	it('marks nothing as best, primary or featured', async () => {
		const { body } = await renderPage({ lang: 'en', ...MORTER });
		expect(body).not.toMatch(/\b(best|primary|featured|highlight)\b/i);
	});
});

describe('Spanish recipe page: back (FE-11)', { timeout: COLD_COMPILE_TIMEOUT_MS }, () => {
	for (const lang of SPAIN_WIDE_LOCALES) {
		it(`${lang}: two variations: back goes to the Variations page, the pill names the dish`, async () => {
			const { body } = await renderPage({ lang, ...MORTER });
			expect(backLinkHref(body, lang)).toBe(`/${lang}/dishes/allioli`);
			expect(pill(body)).toEqual({ label: ALLIOLI.name[lang], href: `/${lang}/dishes/allioli` });
		});

		it(`${lang}: one variation: back goes to Popular, the pill reads "${POPULAR_LABEL[lang]}"`, async () => {
			const { body } = await renderPage({ lang, ...ARROZ });
			const popular = `/${lang}/?tab=popular`;
			expect(backLinkHref(body, lang)).toBe(popular);
			expect(pill(body)).toEqual({ label: POPULAR_LABEL[lang], href: popular });
		});
	}
});

describe('Spanish recipe page: JSON-LD (FE-11)', { timeout: COLD_COMPILE_TIMEOUT_MS }, () => {
	it('two variations: the breadcrumb is Home → dish → variation', async () => {
		const list = onlyNodeOfType(
			(await renderPage({ lang: 'en', ...MORTER })).head,
			'BreadcrumbList'
		);
		expect(breadcrumbItems(list)).toEqual([
			{ position: 1, name: 'Asadorov', item: `${ORIGIN}/en/` },
			{ position: 2, name: 'Allioli', item: `${ORIGIN}/en/dishes/allioli` },
			{
				position: 3,
				name: 'Allioli de morter',
				item: `${ORIGIN}${spainWideRecipePath('en', MORTER.dishKey, MORTER.slug)}`
			}
		]);
	});

	it('one variation: no breadcrumb links the redirected dish URL; the last is this page', async () => {
		const list = onlyNodeOfType(
			(await renderPage({ lang: 'en', ...ARROZ })).head,
			'BreadcrumbList'
		);
		const items = breadcrumbItems(list).map((item) => item.item);
		expect(items).not.toContain(`${ORIGIN}/en/dishes/arrozblanco`);
		expect(items.at(-1)).toBe(`${ORIGIN}${spainWideRecipePath('en', ARROZ.dishKey, ARROZ.slug)}`);
	});

	it('basics: the Recipe node is categorised by the Basics course', async () => {
		const recipe = onlyNodeOfType((await renderPage({ lang: 'en', ...MORTER })).head, 'Recipe');
		expect(recipe.recipeCategory).toBe('Basics');
	});
});
