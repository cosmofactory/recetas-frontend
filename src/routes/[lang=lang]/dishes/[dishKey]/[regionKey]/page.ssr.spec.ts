import { afterEach, describe, expect, it } from 'vitest';
import bundle from '#lib/server/mock/content.bundle.json';
import { buildView } from '#lib/server/mock/bundle-mapping.ts';
import type { Photos } from '#lib/server/catalog-source.ts';
import {
	decodeAmp,
	elementsWith,
	headingTexts,
	metaContents,
	startTags,
	visibleText,
	type StartTag
} from '../../../../../testutil/html';
import { expectedIngredients, recipeIn, type Recipe } from '../../../../../testutil/recipe';
import {
	BETANZOS,
	FABADA_TIME,
	RECIPE_COPY,
	RECIPE_LOCALES,
	RECIPE_TEST_IDS,
	SERVINGS_MAX,
	SERVINGS_MIN,
	variationsPath,
	type RecipeLocale
} from '../../../../../testutil/recipe-copy';
import {
	breadcrumbItems,
	jsonLdDocuments,
	jsonLdScripts,
	onlyNodeOfType
} from '../../../../../testutil/json-ld';
import { loadExport } from '../../../../../testutil/load-export';
import {
	expectHeroPreload,
	expectNoImagePreload,
	imagePreloads
} from '../../../../../testutil/hero-preload';
import { renderKitPage, unmockKit } from '../../../../../testutil/ssr-page';
import { PAGE_COPY, pageTitle } from '../../../../../testutil/variations-copy';

// FE-6 PR 3, the mobile Recipe page (5a) rendered on the server
// (svelte/server). Mobile README -> Screen 3: sticky top bar (back, title =
// variation name), hero photo 220px, eyebrow "REGION · DISH", the variation
// name and description, the info strip (Time; Serves with − / value / +),
// Ingredients (rows: check, name, quantity) and Method (numbered steps).
// Stage FE-6 acceptance: "With JavaScript disabled, both pages render the
// complete content (… ingredients at the base servings, steps)", so all of it
// must be in the server HTML.
//
// Decisions pinned here (FE-6 PR 3):
// - The variation name is the page's one <h1>; "Ingredients" and "Method"
//   are the <h2>s, in that order.
// - The eyebrow text is "{regionName} · {dishName}" from the API; it is
//   upper-cased by CSS only (checked in recipe.e2e.ts), so the HTML keeps the
//   names as written.
// - The time is formatRecipeTime's output (time.spec.ts), in
//   data-testid="recipe-time".
// - The stepper's − / + are <button>s named by the extra-strings.json labels
//   (recipe-copy.ts), disabled at 1 / 20; the value is
//   data-testid="servings-value" and starts at baseServings.
// - Each ingredient row and each step is ONE <button aria-pressed="false">
//   (stage FE-6 -> Small decisions: toggle buttons, like the chips) carrying
//   data-testid="recipe-ingredient" / "recipe-step"; the quantity is
//   data-testid="recipe-quantity" inside the row; steps show their number.
// - The back link's SSR href is the dish's Variations page, named a11y.back.
// - The hero is the recipe's `hero` photo, eager with fetchpriority="high".

type PageData = {
	origin: string;
	mediaBaseUrl: string | undefined;
	regions: unknown[];
	dishes: unknown[];
	recipe: Recipe;
};

const PAGE = 'src/routes/[lang=lang]/dishes/[dishKey]/[regionKey]/+page.svelte';
const ROUTE_ID = '/[lang=lang]/dishes/[dishKey]/[regionKey]';
const ORIGIN = 'http://localhost';
const MEDIA_BASE_URL = 'https://media.example.test';
const PHOTO_SUFFIX = '1a2b';

type RenderSpec = {
	lang: RecipeLocale;
	dishKey?: string;
	regionKey?: string;
	baseServings?: number;
	withPhotos?: boolean;
	description?: string;
};

const photos = (prefix: string): Photos => ({
	thumb: `${prefix}/thumb-${PHOTO_SUFFIX}`,
	card: `${prefix}/card-${PHOTO_SUFFIX}`,
	hero: `${prefix}/hero-${PHOTO_SUFFIX}`
});

function fixtureRecipe(spec: RenderSpec): Recipe {
	const recipe = recipeIn(spec.lang, spec.dishKey ?? 'tortilla', spec.regionKey ?? 'gal');
	const baseServings = spec.baseServings ?? recipe.baseServings;
	const prefix = `dishes/${recipe.dishKey}/${recipe.regionKey}`;
	const description = spec.description ?? recipe.description;
	const photoSet = spec.withPhotos ? photos(prefix) : recipe.photos;
	return { ...recipe, baseServings, description, photos: photoSet };
}

function pageData(spec: RenderSpec): PageData {
	const view = buildView(bundle, spec.lang);
	return {
		origin: ORIGIN,
		mediaBaseUrl: spec.withPhotos ? MEDIA_BASE_URL : undefined,
		regions: view.regions,
		dishes: view.dishes,
		recipe: fixtureRecipe(spec)
	};
}

function renderPage(spec: RenderSpec) {
	const data = pageData(spec);
	const { dishKey, regionKey } = data.recipe;
	return renderKitPage({
		pageFile: PAGE,
		routeId: ROUTE_ID,
		lang: spec.lang,
		url: `/${spec.lang}/dishes/${dishKey}/${regionKey}`,
		params: { lang: spec.lang, dishKey, regionKey },
		data
	});
}

afterEach(unmockKit);

const byTestId = (html: string, id: string) => elementsWith(html, `data-testid="${id}"`);

function onlyByTestId(html: string, id: string): string {
	const found = byTestId(html, id);
	expect(found.length, `got ${found.length} data-testid="${id}", want 1`).toBe(1);
	return found[0];
}

const textOf = (html: string, id: string) => decodeAmp(visibleText(onlyByTestId(html, id)));

const rootTag = (elementHtml: string): StartTag => startTags(elementHtml)[0];

function buttonsNamed(html: string, name: string): StartTag[] {
	return startTags(html).filter((t) => t.name === 'button' && t.attrs['aria-label'] === name);
}

function stepperButton(html: string, name: string): StartTag {
	const found = buttonsNamed(html, name);
	expect(found.length, `want one <button aria-label="${name}">`).toBe(1);
	return found[0];
}

const isDisabled = (tag: StartTag) =>
	tag.attrs.disabled !== undefined || tag.attrs['aria-disabled'] === 'true';

// Each row's quantity, and its name when the row's text has it (the row may
// add hidden text, so the name is matched, not cut out).
function ingredientRows(html: string, want: { name: string }[]) {
	return byTestId(html, RECIPE_TEST_IDS.ingredient).map((row, i) => {
		const text = decodeAmp(visibleText(row));
		const name = want[i] && text.includes(want[i].name) ? want[i].name : `(not in "${text}")`;
		return { name, quantity: textOf(row, RECIPE_TEST_IDS.quantity) };
	});
}

// The first compile of the page and its components can pass Vitest's 5s
// default under a full parallel run.
const COLD_COMPILE_TIMEOUT_MS = 30_000;

describe('Recipe page: header', { timeout: COLD_COMPILE_TIMEOUT_MS }, () => {
	for (const lang of RECIPE_LOCALES) {
		const copy = BETANZOS[lang];
		const eyebrow = `${copy.region} · ${copy.dish}`;

		it(`${lang}: the variation name is the one <h1>: "${copy.name}"`, async () => {
			const { body } = await renderPage({ lang });
			expect(headingTexts(body, 1)).toEqual([copy.name]);
		});

		it(`${lang}: the eyebrow reads "${eyebrow}"`, async () => {
			const { body } = await renderPage({ lang });
			expect(textOf(body, RECIPE_TEST_IDS.eyebrow)).toBe(eyebrow);
		});

		it(`${lang}: shows the variation description`, async () => {
			const text = decodeAmp(visibleText((await renderPage({ lang })).body));
			expect(text, `got no "${copy.description}"`).toContain(copy.description);
		});
	}

	it('order: hero, eyebrow, <h1>, description, info strip, Ingredients, Method', async () => {
		const { body } = await renderPage({ lang: 'en', withPhotos: true });
		const at = [
			body.indexOf(`dishes/tortilla/gal/hero-${PHOTO_SUFFIX}`),
			body.indexOf(`data-testid="${RECIPE_TEST_IDS.eyebrow}"`),
			body.indexOf('<h1'),
			body.indexOf(BETANZOS.en.description),
			body.indexOf(`data-testid="${RECIPE_TEST_IDS.time}"`),
			body.indexOf(RECIPE_COPY.en.ingredients, body.indexOf('<h2')),
			body.indexOf(`data-testid="${RECIPE_TEST_IDS.ingredient}"`),
			body.indexOf(RECIPE_COPY.en.method, body.indexOf('<h2')),
			body.indexOf(`data-testid="${RECIPE_TEST_IDS.step}"`)
		];
		expect(
			at.every((i) => i > -1),
			`got a missing part: ${at}`
		).toBe(true);
		expect(
			[...at].sort((a, b) => a - b),
			`got the parts out of order: ${at}`
		).toEqual(at);
	});

	it('the hero is the recipe hero photo, eager with fetchpriority="high"', async () => {
		const { body } = await renderPage({ lang: 'en', withPhotos: true });
		const heroes = startTags(body).filter(
			(t) => t.name === 'img' && (t.attrs.src ?? '').includes(`gal/hero-${PHOTO_SUFFIX}`)
		);
		expect(heroes.length, 'want one hero <img>').toBe(1);
		expect(heroes[0].attrs.loading).toBe('eager');
		expect(heroes[0].attrs.fetchpriority).toBe('high');
	});

	for (const lang of RECIPE_LOCALES) {
		it(`${lang}: "${RECIPE_COPY[lang].ingredients}" and "${RECIPE_COPY[lang].method}" are the <h2>s`, async () => {
			const { body } = await renderPage({ lang });
			expect(headingTexts(body, 2)).toEqual([
				RECIPE_COPY[lang].ingredients,
				RECIPE_COPY[lang].method
			]);
		});
	}
});

describe('Recipe page: info strip', { timeout: COLD_COMPILE_TIMEOUT_MS }, () => {
	for (const lang of RECIPE_LOCALES) {
		const copy = RECIPE_COPY[lang];

		it(`${lang}: "${copy.time}" ${BETANZOS[lang].time}, "${copy.serves}" at the base 2`, async () => {
			const { body } = await renderPage({ lang });
			const text = visibleText(body);
			for (const label of [copy.time, copy.serves]) {
				expect(text, `got no "${label}"`).toContain(label);
			}
			expect(textOf(body, RECIPE_TEST_IDS.time)).toBe(BETANZOS[lang].time);
			expect(textOf(body, RECIPE_TEST_IDS.servingsValue)).toBe('2');
		});

		it(`${lang}: the fabada's time carries its note: "${FABADA_TIME[lang]}"`, async () => {
			const { body } = await renderPage({ lang, dishKey: 'cocido', regionKey: 'ast' });
			expect(textOf(body, RECIPE_TEST_IDS.time)).toBe(FABADA_TIME[lang]);
		});

		it(`${lang}: − / + are buttons named "${copy.fewer}" / "${copy.more}", both enabled at 2`, async () => {
			const { body } = await renderPage({ lang });
			const fewer = stepperButton(body, copy.fewer);
			const more = stepperButton(body, copy.more);
			expect([isDisabled(fewer), isDisabled(more)]).toEqual([false, false]);
			expect([fewer.attrs.type, more.attrs.type]).toEqual(['button', 'button']);
		});
	}

	it(`a recipe for ${SERVINGS_MIN} starts with − disabled and + enabled`, async () => {
		const { body } = await renderPage({ lang: 'en', baseServings: SERVINGS_MIN });
		expect(textOf(body, RECIPE_TEST_IDS.servingsValue)).toBe(String(SERVINGS_MIN));
		expect(isDisabled(stepperButton(body, RECIPE_COPY.en.fewer)), '−').toBe(true);
		expect(isDisabled(stepperButton(body, RECIPE_COPY.en.more)), '+').toBe(false);
	});

	it(`a recipe for ${SERVINGS_MAX} starts with + disabled and − enabled`, async () => {
		const { body } = await renderPage({ lang: 'en', baseServings: SERVINGS_MAX });
		expect(textOf(body, RECIPE_TEST_IDS.servingsValue)).toBe(String(SERVINGS_MAX));
		expect(isDisabled(stepperButton(body, RECIPE_COPY.en.fewer)), '−').toBe(false);
		expect(isDisabled(stepperButton(body, RECIPE_COPY.en.more)), '+').toBe(true);
	});

	it('the servings announcement is an aria-live="polite" element', async () => {
		const { body } = await renderPage({ lang: 'en' });
		const live = rootTag(onlyByTestId(body, RECIPE_TEST_IDS.servingsLive));
		expect(live.attrs['aria-live']).toBe('polite');
	});
});

describe('Recipe page: ingredients', { timeout: COLD_COMPILE_TIMEOUT_MS }, () => {
	for (const lang of RECIPE_LOCALES) {
		it(`${lang}: every ingredient with its quantity at the base servings`, async () => {
			const recipe = recipeIn(lang, 'tortilla', 'gal');
			const want = expectedIngredients(lang, recipe, recipe.baseServings);
			const { body } = await renderPage({ lang });
			expect(ingredientRows(body, want)).toEqual(want);
		});
	}

	it('the fabada (base 4) shows its own quantities at 4', async () => {
		const recipe = recipeIn('en', 'cocido', 'ast');
		const want = expectedIngredients('en', recipe, 4);
		const { body } = await renderPage({ lang: 'en', dishKey: 'cocido', regionKey: 'ast' });
		expect(ingredientRows(body, want)).toEqual(want);
	});

	it('each row is one <button type="button" aria-pressed="false"> with no link inside', async () => {
		const rows = byTestId((await renderPage({ lang: 'en' })).body, RECIPE_TEST_IDS.ingredient);
		expect(rows.length, 'got no ingredient rows').toBe(4);
		for (const row of rows) {
			const tag = rootTag(row);
			expect([tag.name, tag.attrs.type, tag.attrs['aria-pressed']]).toEqual([
				'button',
				'button',
				'false'
			]);
			expect(startTags(row).filter((t) => t.name === 'a' || t.name === 'button').length).toBe(1);
		}
	});
});

describe('Recipe page: method', { timeout: COLD_COMPILE_TIMEOUT_MS }, () => {
	for (const lang of RECIPE_LOCALES) {
		it(`${lang}: every step, numbered from 1, in order`, async () => {
			const recipe = recipeIn(lang, 'tortilla', 'gal');
			const steps = byTestId((await renderPage({ lang })).body, RECIPE_TEST_IDS.step);
			expect(steps.length).toBe(recipe.steps.length);
			for (const [i, step] of steps.entries()) {
				const text = decodeAmp(visibleText(step));
				expect(text, `step ${i + 1}`).toMatch(new RegExp(`^${i + 1}\\b`));
				expect(text, `step ${i + 1}`).toContain(recipe.steps[i]);
			}
		});
	}

	it('each step is one <button type="button" aria-pressed="false">', async () => {
		const steps = byTestId((await renderPage({ lang: 'en' })).body, RECIPE_TEST_IDS.step);
		for (const step of steps) {
			const tag = rootTag(step);
			expect([tag.name, tag.attrs.type, tag.attrs['aria-pressed']]).toEqual([
				'button',
				'button',
				'false'
			]);
		}
	});
});

describe('Recipe page: sticky top bar', { timeout: COLD_COMPILE_TIMEOUT_MS }, () => {
	for (const lang of RECIPE_LOCALES) {
		const want = variationsPath(lang, 'tortilla');

		it(`${lang}: the back link goes to ${want}, named "${PAGE_COPY[lang].back}"`, async () => {
			const { body } = await renderPage({ lang });
			const back = startTags(body).filter(
				(t) => t.name === 'a' && t.attrs['aria-label'] === PAGE_COPY[lang].back
			);
			expect(back.length, `want one link named "${PAGE_COPY[lang].back}"`).toBe(1);
			expect(decodeAmp(back[0].attrs.href ?? '')).toBe(want);
		});

		it(`${lang}: the bar title is the variation name, hidden until scrolled`, async () => {
			const { body } = await renderPage({ lang });
			const hidden = startTags(body).filter((t) => t.attrs['aria-hidden'] === 'true');
			expect(hidden.length, 'want the faded title aria-hidden').toBeGreaterThan(0);
			const names = body.split(BETANZOS[lang].name).length - 1;
			expect(names, 'want the name in the bar and in the <h1>').toBeGreaterThanOrEqual(2);
		});
	}

	it('the fabada: the fallback is its own dish', async () => {
		const { body } = await renderPage({ lang: 'en', dishKey: 'cocido', regionKey: 'ast' });
		const back = startTags(body).find(
			(t) => t.name === 'a' && t.attrs['aria-label'] === PAGE_COPY.en.back
		);
		expect(decodeAmp(back?.attrs.href ?? '')).toBe(variationsPath('en', 'cocido'));
	});
});

describe('Recipe page: head', { timeout: COLD_COMPILE_TIMEOUT_MS }, () => {
	for (const lang of RECIPE_LOCALES) {
		const copy = BETANZOS[lang];
		const title = pageTitle(copy.dish, copy.name);

		it(`${lang}: <title>${title}</title> and the variation description`, async () => {
			const { head } = await renderPage({ lang });
			expect(head).toContain(`<title>${title}</title>`);
			const meta = startTags(head).filter(
				(t) => t.name === 'meta' && t.attrs.name === 'description'
			);
			expect(meta.map((t) => t.attrs.content)).toEqual([copy.description]);
		});
	}
});

describe('Recipe page: all variations equal', { timeout: COLD_COMPILE_TIMEOUT_MS }, () => {
	it('marks nothing as best, primary or featured', async () => {
		const { body } = await renderPage({ lang: 'en' });
		expect(body).not.toMatch(/\b(best|primary|featured|highlight)\b/i);
	});
});

// FE-8 PR 1 (stage FE-8 -> SEO, meta tags: "an OG image from the hero photo
// or a static fallback"): the page's head carries og:image, the recipe's hero as
// its largest JPEG on the media origin (og-image.spec.ts), else the static
// fallback on the page's origin (data.origin, PUBLIC_ORIGIN).
describe('Recipe page og:image (FE-8)', () => {
	it("is the recipe's hero photo when there is one", async () => {
		const { head } = await renderPage({ lang: 'en', withPhotos: true });
		const want = `${MEDIA_BASE_URL}/dishes/tortilla/gal/hero-1a2b-1600w.jpg`;
		expect(metaContents(head, 'og:image'), `want og:image ${want}`).toEqual([want]);
	});

	it('is the static fallback without photos', async () => {
		const { head } = await renderPage({ lang: 'es' });
		const want = `${ORIGIN}/og-default.png`;
		expect(metaContents(head, 'og:image'), `want og:image ${want}`).toEqual([want]);
	});
});

// FE-8 PR 2 (stage FE-8 -> SEO: JSON-LD schema.org/Recipe on recipe pages;
// the object itself is pinned in recipe-json-ld.spec.ts, its serialisation
// in json-ld.spec.ts). Decisions pinned here:
// - The page puts its JSON-LD in the head (never the body), in
//   <script type="application/ld+json">; every document carries @context
//   https://schema.org.
// - It holds exactly one Recipe node, equal to recipeJsonLd for this
//   recipe, its dish's course (from the [lang=lang] layout's `dishes`), the
//   page's canonical URL (headLinks on data.origin) and data.mediaBaseUrl.
// - The Recipe page also gets a BreadcrumbList, Home → dish → variation
//   (decided in FE-8 PR 2: Google shows the trail in results and the data is
//   already on the page): "Asadorov" (the brand, untranslated, like the
//   site name) at /:lang/, the dish name at its Variations page, the
//   variation name at this page; `item` is absolute on every step.
// - Content can't break out of the script: a description holding
//   "</script>" leaves exactly one JSON-LD script, whose text has no "<".
type RecipeJsonLd = (input: Record<string, unknown>) => Record<string, unknown>;

const canonicalOf = (lang: RecipeLocale, path = '/dishes/tortilla/gal') =>
	`${ORIGIN}/${lang}${path}`;

describe('Recipe page JSON-LD (FE-8)', { timeout: COLD_COMPILE_TIMEOUT_MS }, () => {
	for (const lang of RECIPE_LOCALES) {
		it(`${lang}: one Recipe node, equal to recipeJsonLd for this page`, async () => {
			const spec: RenderSpec = { lang, withPhotos: true };
			const { head } = await renderPage(spec);
			const recipeJsonLd = await loadExport<RecipeJsonLd>(
				'src/lib/seo/recipe-json-ld.ts',
				'recipeJsonLd'
			);
			const want = recipeJsonLd({
				recipe: fixtureRecipe(spec),
				course: 'tapas',
				lang,
				url: canonicalOf(lang),
				origin: ORIGIN,
				mediaBaseUrl: MEDIA_BASE_URL
			});
			expect(onlyNodeOfType(head, 'Recipe')).toEqual(want);
		});

		it(`${lang}: the Recipe's url is the canonical, in ${lang}`, async () => {
			const node = onlyNodeOfType((await renderPage({ lang })).head, 'Recipe');
			expect([node.url, node.inLanguage, node.name]).toEqual([
				canonicalOf(lang),
				lang,
				BETANZOS[lang].name
			]);
		});

		it(`${lang}: a BreadcrumbList Home → dish → variation`, async () => {
			const list = onlyNodeOfType((await renderPage({ lang })).head, 'BreadcrumbList');
			expect(breadcrumbItems(list)).toEqual([
				{ position: 1, name: 'Asadorov', item: `${ORIGIN}/${lang}/` },
				{ position: 2, name: BETANZOS[lang].dish, item: canonicalOf(lang, '/dishes/tortilla') },
				{ position: 3, name: BETANZOS[lang].name, item: canonicalOf(lang) }
			]);
		});
	}

	it('the fabada: recipeCategory from its dish’s course (mains)', async () => {
		const { head } = await renderPage({ lang: 'es', dishKey: 'cocido', regionKey: 'ast' });
		expect(onlyNodeOfType(head, 'Recipe').recipeCategory).toBe('Principales');
	});

	it('every JSON-LD document names the schema.org context', async () => {
		const docs = jsonLdDocuments((await renderPage({ lang: 'en' })).head);
		expect(docs.length, 'got no JSON-LD in the head').toBeGreaterThan(0);
		for (const doc of docs) expect(doc['@context']).toBe('https://schema.org');
	});

	it('the JSON-LD is in the head, never the body', async () => {
		const { head, body } = await renderPage({ lang: 'en' });
		expect(jsonLdScripts(head).length, 'got no JSON-LD in the head').toBeGreaterThan(0);
		expect(jsonLdScripts(body)).toEqual([]);
	});

	it('the image includes the og:image (the hero’s largest JPEG)', async () => {
		const { head } = await renderPage({ lang: 'en', withPhotos: true });
		const ogImage = metaContents(head, 'og:image')[0];
		expect([onlyNodeOfType(head, 'Recipe').image].flat()).toContain(ogImage);
	});

	it('without photos the image is [the og:image fallback]', async () => {
		const { head } = await renderPage({ lang: 'ru' });
		expect([onlyNodeOfType(head, 'Recipe').image].flat()).toEqual([`${ORIGIN}/og-default.png`]);
	});

	describe('a description holding </script>', () => {
		const HOSTILE = 'Runny </script><script>alert(1)</script><!-- & "more" -->';

		it('cannot close the JSON-LD script or add one', async () => {
			const { head } = await renderPage({ lang: 'en', description: HOSTILE });
			expect(head).not.toContain('<script>alert(1)');
			const docs = jsonLdScripts(head);
			expect(docs.length, 'want the JSON-LD intact').toBeGreaterThan(0);
			for (const text of docs) expect(text, `got "<" in ${text}`).not.toContain('<');
		});

		it('round-trips: the Recipe description is the text as written', async () => {
			const { head } = await renderPage({ lang: 'en', description: HOSTILE });
			expect(onlyNodeOfType(head, 'Recipe').description).toBe(HOSTILE);
		});
	});
});

// FE-8 PR 3: the hero preload (rules in testutil/hero-preload.ts).
describe('Recipe page: hero preload (FE-8)', { timeout: COLD_COMPILE_TIMEOUT_MS }, () => {
	for (const lang of ['en', 'es', 'ru'] as const) {
		it(`${lang}: with a hero photo the head preloads it, matching the <picture>`, async () => {
			expectHeroPreload(
				await renderPage({ lang, withPhotos: true }),
				'dishes/tortilla/gal/hero-1a2b'
			);
		});
	}

	it('without photos there is no image preload', async () => {
		expectNoImagePreload(await renderPage({ lang: 'en' }));
	});

	it('the preload is in the head, never the body', async () => {
		const { body } = await renderPage({ lang: 'en', withPhotos: true });
		expect(imagePreloads(body)).toEqual([]);
	});
});
