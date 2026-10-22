import { describe, expect, it } from 'vitest';
import type { components } from '#lib/api/schema.d.ts';
import { withRequestLocale } from '#lib/server/request-locale.ts';
import { loadExport } from '../../testutil/load-export';
import { expectedIngredients, recipeIn, type Recipe } from '../../testutil/recipe';
import { RECIPE_LOCALES, type RecipeLocale } from '../../testutil/recipe-copy';

// FE-8 PR 2 (stage FE-8 -> SEO: "JSON-LD schema.org/Recipe on recipe pages,
// in the page's locale"; Acceptance: the Rich Results Test passes for a
// recipe page in each locale). `recipeJsonLd(input)` in
// #lib/seo/recipe-json-ld.ts builds the object; the page serialises it
// (json-ld.spec.ts). Decisions pinned here:
// - name / description: the variation's (Recipe.name / description), in the
//   page's locale.
// - image: an array of absolute JPEG URLs of the hero, one per hero width,
//   from #lib/media.ts's URL format (`<prefix>-<w>w.jpg`); JPEG for the same
//   reason as og:image. Google requires an image for a Recipe rich result,
//   so without a usable hero (no prefix, no MEDIA_BASE_URL, a rejected
//   prefix) it is [the og:image fallback] (<origin>/og-default.png), the
//   same image the page's og:image shows, rather than no image.
// - recipeIngredient: "<quantity> <name>" per ingredient at the base
//   servings, the quantity from the page's own formatter
//   (ingredientQuantity/formatQuantity, unitLabel), in the locale.
// - recipeInstructions: one HowToStep per step, { '@type', position (from
//   1), text }.
// - totalTime: isoDuration(timeMinutes); the time note ("+ soaking") is
//   free text and stays out.
// - recipeYield: the base servings as a digit string ("2"): Google asks
//   for "just a number" and schema.org types it Text/QuantitativeValue, so a
//   string of digits satisfies both and needs no localisation.
// - recipeCuisine: "Spanish" in every locale, as the stage file says: it is
//   a classification value (aggregated across pages), not copy, and
//   strings.json has no translation for it.
// - recipeCategory: the course's localised filter label
//   (strings.json home.filterLabels: Tapas / Mains / Desserts).
// - inLanguage: en | es | ru; url: the page's canonical (passed in).
// - Nothing else (no author, rating or "best" marker: the site has no
//   accounts or ratings, CLAUDE.md scope rules).

type Course = components['schemas']['Course'];
type RecipeJsonLdInput = {
	recipe: Recipe;
	course: Course;
	lang: RecipeLocale;
	url: string;
	origin: string;
	mediaBaseUrl: string | undefined;
};
type RecipeJsonLd = (input: RecipeJsonLdInput) => Record<string, unknown>;

const MODULE = 'src/lib/seo/recipe-json-ld.ts';
const ORIGIN = 'https://asadorov.es';
const MEDIA = 'https://media.example.test';
const HERO = 'dishes/tortilla/gal/hero-1a2b';
const FALLBACK_IMAGE = `${ORIGIN}/og-default.png`;

const COURSE_LABELS: Record<RecipeLocale, Record<Course, string>> = {
	en: { tapas: 'Tapas', mains: 'Mains', desserts: 'Desserts' },
	es: { tapas: 'Tapas', mains: 'Principales', desserts: 'Postres' },
	ru: { tapas: 'Тапас', mains: 'Основные', desserts: 'Десерты' }
};

type BuildSpec = Partial<RecipeJsonLdInput> & { lang: RecipeLocale; hero?: string | null };

function input(spec: BuildSpec): RecipeJsonLdInput {
	const base = spec.recipe ?? recipeIn(spec.lang, 'tortilla', 'gal');
	const hero = spec.hero === undefined ? HERO : spec.hero;
	const recipe = { ...base, photos: { ...base.photos, hero } };
	return {
		recipe,
		course: spec.course ?? 'tapas',
		lang: spec.lang,
		url: spec.url ?? `${ORIGIN}/${spec.lang}/dishes/${recipe.dishKey}/${recipe.regionKey}`,
		origin: spec.origin ?? ORIGIN,
		mediaBaseUrl: 'mediaBaseUrl' in spec ? spec.mediaBaseUrl : MEDIA
	};
}

async function build(spec: BuildSpec): Promise<Record<string, unknown>> {
	const recipeJsonLd = await loadExport<RecipeJsonLd>(MODULE, 'recipeJsonLd');
	return withRequestLocale(spec.lang, () => recipeJsonLd(input(spec)));
}

const sortedImages = (node: Record<string, unknown>) => [node.image].flat().map(String).sort();

// The hand-written snapshot: Betanzos-style runny (tortilla/gal) in English,
// with a hero photo. Images are compared as a set (their order is free).
const BETANZOS_EN = {
	'@context': 'https://schema.org',
	'@type': 'Recipe',
	name: 'Betanzos-style runny',
	description: 'Barely-set centre, no onion, eaten with bread',
	image: [`${MEDIA}/${HERO}-1600w.jpg`, `${MEDIA}/${HERO}-800w.jpg`],
	recipeIngredient: ['4 Eggs', '400 g Waxy potatoes', '250 ml Olive oil, for confit', '1 tsp Salt'],
	recipeInstructions: [
		'Peel the potatoes and slice them very thin.',
		'Confit in the oil over low heat for 15 minutes, until soft but not coloured. Drain and keep the oil.',
		'Beat the eggs with the salt, fold in the hot potatoes and rest for 5 minutes.',
		'Heat a spoon of the oil in a small pan until very hot. Pour in and cook for 40 seconds.',
		'Flip with a plate, cook 20 seconds more and serve at once — the centre should run.'
	].map((text, i) => ({ '@type': 'HowToStep', position: i + 1, text })),
	totalTime: 'PT25M',
	recipeYield: '2',
	recipeCuisine: 'Spanish',
	recipeCategory: 'Tapas',
	inLanguage: 'en',
	url: `${ORIGIN}/en/dishes/tortilla/gal`
};

describe('recipeJsonLd: snapshot', () => {
	it('Betanzos-style runny (en, with a hero) is exactly the expected object', async () => {
		const got = await build({ lang: 'en' });
		expect({ ...got, image: sortedImages(got) }).toEqual(BETANZOS_EN);
	});

	it('is plain JSON (nothing JSON.stringify would drop or change)', async () => {
		const got = await build({ lang: 'ru' });
		expect(JSON.parse(JSON.stringify(got))).toEqual(got);
	});
});

describe('recipeJsonLd: per locale', () => {
	for (const lang of RECIPE_LOCALES) {
		const recipe = recipeIn(lang, 'tortilla', 'gal');

		it(`${lang}: @context, @type, name, description, inLanguage and url`, async () => {
			const got = await build({ lang });
			expect(got['@context']).toBe('https://schema.org');
			expect(got['@type']).toBe('Recipe');
			expect([got.name, got.description]).toEqual([recipe.name, recipe.description]);
			expect(got.inLanguage).toBe(lang);
			expect(got.url).toBe(`${ORIGIN}/${lang}/dishes/tortilla/gal`);
		});

		it(`${lang}: recipeIngredient is "<quantity> <name>" at the base servings`, async () => {
			const want = expectedIngredients(lang, recipe, recipe.baseServings).map(
				(i) => `${i.quantity} ${i.name}`
			);
			expect((await build({ lang })).recipeIngredient).toEqual(want);
		});

		it(`${lang}: recipeInstructions are HowToSteps in order, numbered from 1`, async () => {
			const want = recipe.steps.map((text, i) => ({ '@type': 'HowToStep', position: i + 1, text }));
			expect((await build({ lang })).recipeInstructions).toEqual(want);
		});

		it(`${lang}: recipeCuisine stays "Spanish"`, async () => {
			expect((await build({ lang })).recipeCuisine).toBe('Spanish');
		});

		for (const course of ['tapas', 'mains', 'desserts'] as const) {
			const want = COURSE_LABELS[lang][course];
			it(`${lang}: course ${course} -> recipeCategory "${want}"`, async () => {
				expect((await build({ lang, course })).recipeCategory).toBe(want);
			});
		}
	}
});

describe('recipeJsonLd: time and yield', () => {
	it('the fabada (180 min + soaking, for 4): PT3H and "4", the note left out', async () => {
		const got = await build({ lang: 'es', recipe: recipeIn('es', 'cocido', 'ast') });
		expect([got.totalTime, got.recipeYield]).toEqual(['PT3H', '4']);
	});

	it('the fabada’s ingredients are at its base 4', async () => {
		const recipe = recipeIn('en', 'cocido', 'ast');
		const want = expectedIngredients('en', recipe, 4).map((i) => `${i.quantity} ${i.name}`);
		expect((await build({ lang: 'en', recipe })).recipeIngredient).toEqual(want);
	});
});

describe('recipeJsonLd: image', () => {
	it('with a hero: every hero width as an absolute JPEG on the media origin', async () => {
		const got = await build({ lang: 'en' });
		expect(sortedImages(got)).toEqual([`${MEDIA}/${HERO}-1600w.jpg`, `${MEDIA}/${HERO}-800w.jpg`]);
	});

	const fallbacks: { name: string; spec: BuildSpec }[] = [
		{ name: 'no hero photo', spec: { lang: 'en', hero: null } },
		{ name: 'no MEDIA_BASE_URL', spec: { lang: 'en', mediaBaseUrl: undefined } },
		{ name: 'a prefix media.ts rejects', spec: { lang: 'en', hero: '../evil.example/x' } }
	];
	for (const { name, spec } of fallbacks) {
		it(`${name}: [the og:image fallback] on the origin, never no image`, async () => {
			expect(sortedImages(await build(spec))).toEqual([FALLBACK_IMAGE]);
		});
	}

	it('the fallback follows the given origin', async () => {
		const got = await build({ lang: 'en', hero: null, origin: 'http://127.0.0.1:4173' });
		expect(sortedImages(got)).toEqual(['http://127.0.0.1:4173/og-default.png']);
	});
});
