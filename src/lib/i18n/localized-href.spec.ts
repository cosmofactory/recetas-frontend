import { describe, expect, it } from 'vitest';
import { loadExport } from '../../testutil/load-export';

// FE-1: every internal link goes through localizedHref(path, lang), which puts
// the locale prefix in front of a locale-free app path.

type LocalizedHref = (path: string, lang: string) => string;

describe('localizedHref', () => {
	const cases: [string, string, string][] = [
		['/', 'en', '/en/'],
		['/', 'ru', '/ru/'],
		['/?tab=popular', 'es', '/es/?tab=popular'],
		['/regions/gal', 'ru', '/ru/regions/gal'],
		['/dishes/tortilla', 'es', '/es/dishes/tortilla'],
		['/dishes/tortilla/gal', 'en', '/en/dishes/tortilla/gal']
	];
	for (const [path, lang, want] of cases) {
		it(`localizedHref(${path}, ${lang}) is ${want}`, async () => {
			const localizedHref = await loadExport<LocalizedHref>(
				'src/lib/i18n/localized-href.ts',
				'localizedHref'
			);
			const got = localizedHref(path, lang);
			expect(got, `got ${got}, want ${want}`).toBe(want);
		});
	}
});

// FE-11 (both READMEs -> routes; "Spanish (Spain-wide) variations"): a
// Spanish variation's Recipe page is /:lang/dishes/:dishKey/esp/:variationSlug;
// a regional one stays /:lang/dishes/:dishKey/:regionKey. A dish with exactly
// one variation in total has no Variations page, so a link to the dish goes
// straight to that recipe.
//
// Contract assumed (src/lib/i18n/localized-href.ts):
// - variationRecipeHref(dishKey, variation, lang), variation carrying
//   { regionKey, variationSlug } (a VariationSummary or a Recipe);
// - dishHref(dish, lang), dish carrying { key, variations }: the Variations
//   page, or the only variation's Recipe page.

type VariationTarget = { regionKey: string; variationSlug: string | null };
type VariationRecipeHref = (dishKey: string, variation: VariationTarget, lang: string) => string;
type DishTarget = { key: string; variations: VariationTarget[] };
type DishHref = (dish: DishTarget, lang: string) => string;

const MODULE = 'src/lib/i18n/localized-href.ts';
const GAL: VariationTarget = { regionKey: 'gal', variationSlug: null };
const AST: VariationTarget = { regionKey: 'ast', variationSlug: null };
const MORTER: VariationTarget = { regionKey: 'esp', variationSlug: 'allioli-de-morter' };
const CODONY: VariationTarget = { regionKey: 'esp', variationSlug: 'allioli-de-codony' };

describe('variationRecipeHref', () => {
	const cases: {
		why: string;
		dishKey: string;
		variation: VariationTarget;
		lang: string;
		want: string;
	}[] = [
		{
			why: 'a regional variation: its region key',
			dishKey: 'tortilla',
			variation: GAL,
			lang: 'en',
			want: '/en/dishes/tortilla/gal'
		},
		{
			why: 'a Spanish variation: esp, then its slug',
			dishKey: 'allioli',
			variation: MORTER,
			lang: 'en',
			want: '/en/dishes/allioli/esp/allioli-de-morter'
		},
		{
			why: 'the slug is the same in every locale (ru)',
			dishKey: 'allioli',
			variation: CODONY,
			lang: 'ru',
			want: '/ru/dishes/allioli/esp/allioli-de-codony'
		}
	];
	for (const tc of cases) {
		it(`${tc.why}: ${tc.want}`, async () => {
			const href = await loadExport<VariationRecipeHref>(MODULE, 'variationRecipeHref');
			const got = href(tc.dishKey, tc.variation, tc.lang);
			expect(got, `got ${got}, want ${tc.want}`).toBe(tc.want);
		});
	}
});

describe('dishHref', () => {
	const cases: { why: string; dish: DishTarget; lang: string; want: string }[] = [
		{
			why: 'two variations: the Variations page',
			dish: { key: 'tortilla', variations: [GAL, AST] },
			lang: 'en',
			want: '/en/dishes/tortilla'
		},
		{
			why: 'two Spanish variations: the Variations page',
			dish: { key: 'allioli', variations: [MORTER, CODONY] },
			lang: 'es',
			want: '/es/dishes/allioli'
		},
		{
			why: 'one Spanish variation: its recipe',
			dish: {
				key: 'arrozblanco',
				variations: [{ regionKey: 'esp', variationSlug: 'arroz-blanco-con-tomate' }]
			},
			lang: 'ru',
			want: '/ru/dishes/arrozblanco/esp/arroz-blanco-con-tomate'
		},
		{
			why: 'one regional variation: its recipe',
			dish: { key: 'tortilla', variations: [GAL] },
			lang: 'en',
			want: '/en/dishes/tortilla/gal'
		}
	];
	for (const tc of cases) {
		it(`${tc.why}: ${tc.want}`, async () => {
			const dishHref = await loadExport<DishHref>(MODULE, 'dishHref');
			const got = dishHref(tc.dish, tc.lang);
			expect(got, `got ${got}, want ${tc.want}`).toBe(tc.want);
		});
	}
});

describe('variationRecipeHref: a Spanish variation without a slug', () => {
	it('throws rather than build a dead /esp link', async () => {
		const href = await loadExport<VariationRecipeHref>(MODULE, 'variationRecipeHref');
		expect(() => href('allioli', { regionKey: 'esp', variationSlug: null }, 'en')).toThrow();
	});
});
