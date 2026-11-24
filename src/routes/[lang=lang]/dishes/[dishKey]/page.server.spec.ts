import { afterEach, describe, expect, it } from 'vitest';
import type { CatalogSource, Dish } from '#lib/server/catalog-source.ts';
import {
	loadEvent,
	loadRoute,
	outcomeOf,
	showOutcome,
	unmockCatalog,
	type LoadOutcome
} from '../../../../testutil/route-load';
import { ARROZ_BLANCO_RECIPE_PATH } from '../../../../testutil/spain-wide';

// FE-11, the single-variation rule on the Variations page loader (both
// READMEs -> routes: "/:lang/dishes/:dishKey  Variations page (a dish with
// exactly one variation: 301 to its recipe)"; "Spanish (Spain-wide)
// variations"; stage FE-11 -> Routes). Decisions pinned here:
// - The redirect is permanent, 301 (not Kit's default 307/308 choice).
// - The target is that variation's Recipe URL in the request's locale:
//   /:lang/dishes/:dishKey/:regionKey for a regional variation,
//   /:lang/dishes/:dishKey/esp/:variationSlug for a Spanish one.
// - A dish with two or more variations (regional, Spanish or both) loads as
//   before: `{ dish }`.
// - An unknown dish stays a 404.

const PAGE_SERVER = 'src/routes/[lang=lang]/dishes/[dishKey]/+page.server.ts';
const MOVED_PERMANENTLY = 301;
const NOT_FOUND = 404;

afterEach(unmockCatalog);

// The mock catalog with one dish cut down to its first variation.
function withOneVariation(dishKey: string) {
	return (source: CatalogSource): CatalogSource => ({
		...source,
		getDish: async (lang, key) => {
			const dish = await source.getDish(lang, key);
			if (key !== dishKey) return dish;
			return { ...dish, variations: dish.variations.slice(0, 1) };
		}
	});
}

type Spec = { lang: string; dishKey: string; override?: (s: CatalogSource) => CatalogSource };

async function loadDishPage({ lang, dishKey, override }: Spec): Promise<LoadOutcome> {
	const load = await loadRoute(PAGE_SERVER, override);
	return outcomeOf(load, loadEvent(`/${lang}/dishes/${dishKey}`, { lang, dishKey }));
}

function expectRedirect(got: LoadOutcome, location: string) {
	const want: LoadOutcome = { kind: 'redirect', status: MOVED_PERMANENTLY, location };
	expect(got, `got ${showOutcome(got)}, want ${showOutcome(want)}`).toEqual(want);
}

function expectDish(got: LoadOutcome, dishKey: string, variationCount: number) {
	expect(got.kind, `got ${showOutcome(got)}, want the dish`).toBe('data');
	const dish = (got as { data: { dish?: Dish } }).data.dish;
	expect(dish?.key).toBe(dishKey);
	expect(dish?.variations.length).toBe(variationCount);
}

describe('Variations page load: a dish with one variation (FE-11)', () => {
	for (const lang of ['en', 'es', 'ru']) {
		it(`${lang}: arroz blanco (one Spanish variation) answers 301 to its recipe`, async () => {
			const got = await loadDishPage({ lang, dishKey: 'arrozblanco' });
			expectRedirect(got, ARROZ_BLANCO_RECIPE_PATH(lang));
		});
	}

	it('a dish with one regional variation answers 301 to /:lang/dishes/:dishKey/:regionKey', async () => {
		const got = await loadDishPage({
			lang: 'ru',
			dishKey: 'paella',
			override: withOneVariation('paella')
		});
		expectRedirect(got, '/ru/dishes/paella/cat');
	});
});

describe('Variations page load: dishes with a Variations page', () => {
	it('allioli (two Spanish variations) loads its dish', async () => {
		expectDish(await loadDishPage({ lang: 'en', dishKey: 'allioli' }), 'allioli', 2);
	});

	it('tortilla (13 regional variations) loads its dish', async () => {
		expectDish(await loadDishPage({ lang: 'es', dishKey: 'tortilla' }), 'tortilla', 13);
	});

	it('an unknown dish is a 404', async () => {
		const got = await loadDishPage({ lang: 'en', dishKey: 'nope' });
		expect(got, `got ${showOutcome(got)}`).toEqual({ kind: 'error', status: NOT_FOUND });
	});
});
