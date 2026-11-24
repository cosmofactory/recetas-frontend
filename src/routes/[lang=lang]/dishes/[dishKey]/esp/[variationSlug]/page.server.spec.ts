import { afterEach, describe, expect, it } from 'vitest';
import type { Recipe } from '#lib/server/catalog-source.ts';
import {
	loadEvent,
	loadRoute,
	outcomeOf,
	showOutcome,
	unmockCatalog,
	type LoadOutcome
} from '../../../../../../testutil/route-load';
import { ALLIOLI, ARROZ_BLANCO } from '../../../../../../testutil/spain-wide';

// FE-11, the new route /[lang]/dishes/[dishKey]/esp/[variationSlug]: the
// Recipe page of a Spanish (Spain-wide) variation (both READMEs -> routes;
// stage FE-11 -> Routes: "with its loader on getSpainWideRecipe. The static
// `esp` segment takes precedence over [regionKey]"). Decisions pinned here:
// - src/routes/[lang=lang]/dishes/[dishKey]/esp/[variationSlug]/+page.server.ts
//   loads `{ recipe }` from catalog().getSpainWideRecipe(lang, { dishKey,
//   variationSlug }), like the regional Recipe page loads `{ recipe }`.
// - An unknown slug, a slug of another dish, or an unknown dish is a 404.

const PAGE_SERVER = 'src/routes/[lang=lang]/dishes/[dishKey]/esp/[variationSlug]/+page.server.ts';
const NOT_FOUND = 404;

afterEach(unmockCatalog);

async function loadSpanishRecipe(lang: string, dishKey: string, variationSlug: string) {
	const load = await loadRoute(PAGE_SERVER);
	const path = `/${lang}/dishes/${dishKey}/esp/${variationSlug}`;
	return outcomeOf(load, loadEvent(path, { lang, dishKey, variationSlug }));
}

function recipeIn(got: LoadOutcome): Recipe | undefined {
	expect(got.kind, `got ${showOutcome(got)}, want data`).toBe('data');
	return (got as { data: { recipe?: Recipe } }).data.recipe;
}

describe('Spanish recipe page load (FE-11)', () => {
	for (const variation of ALLIOLI.variations) {
		it(`en: loads ${variation.slug}`, async () => {
			const recipe = recipeIn(await loadSpanishRecipe('en', ALLIOLI.key, variation.slug));
			expect(recipe?.recipeKey).toBe(`allioli-esp-${variation.slug}`);
			expect(recipe?.name).toBe(variation.name);
			expect(recipe?.regionKey).toBe('esp');
			expect(recipe?.variationSlug).toBe(variation.slug);
		});
	}

	it('ru: loads the localized recipe of arroz blanco', async () => {
		const [only] = ARROZ_BLANCO.variations;
		const recipe = recipeIn(await loadSpanishRecipe('ru', ARROZ_BLANCO.key, only.slug));
		expect(recipe?.dishName).toBe(ARROZ_BLANCO.name.ru);
		expect(recipe?.ingredients[0]?.name).toBe('Длиннозёрный рис');
	});

	const misses = [
		{ why: 'an unknown slug', dishKey: 'allioli', slug: 'allioli-de-nada' },
		{ why: "another dish's slug", dishKey: 'arrozblanco', slug: 'allioli-de-morter' },
		{ why: 'an unknown dish', dishKey: 'nope', slug: 'allioli-de-morter' },
		{ why: 'a regional dish has no Spanish variation', dishKey: 'tortilla', slug: 'gal' }
	];
	for (const miss of misses) {
		it(`${miss.why} is a 404`, async () => {
			const got = await loadSpanishRecipe('en', miss.dishKey, miss.slug);
			expect(got, `got ${showOutcome(got)}`).toEqual({ kind: 'error', status: NOT_FOUND });
		});
	}
});
