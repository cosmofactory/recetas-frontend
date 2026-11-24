import { describe, expect, it } from 'vitest';
import type { Locale } from '#lib/i18n/locales.ts';
import type { Dish } from '#lib/server/catalog-source.ts';
import { buildView } from '#lib/server/mock/bundle-mapping.ts';
import bundle from '#lib/server/mock/content.bundle.json';
import { withRequestLocale } from '#lib/server/request-locale.ts';
import { loadExport } from '../../testutil/load-export';
import { ALLIOLI, SPAIN_WIDE_LABEL, SPAIN_WIDE_LOCALES } from '../../testutil/spain-wide';

// The Popular card's preview line (mobile README -> Popular tab: "first two
// variations as "Region · Variation · Region · Variation""), and FE-11's
// region-slot rule on it: a Spanish variation shows spainWide.label where the
// region name goes, "Spanish · Allioli de morter" (both READMEs -> "Spanish
// (Spain-wide) variations").
//
// Contract assumed: dishPreview(dish, locale?) in src/lib/content/dish-preview.ts.
// The specs pass the locale and also run inside the request locale, so the
// helper may take the locale explicitly or read the request's.

type DishPreview = (dish: Pick<Dish, 'variations'>, locale?: Locale) => string;

const loadPreview = () => loadExport<DishPreview>('src/lib/content/dish-preview.ts', 'dishPreview');

const dishIn = (lang: Locale, key: string): Dish => {
	const dish = buildView(bundle, lang).dishesByKey.get(key);
	if (!dish) throw new Error(`no fixture dish ${key}`);
	return dish;
};

async function previewOf(lang: Locale, dish: Pick<Dish, 'variations'>): Promise<string> {
	const dishPreview = await loadPreview();
	return withRequestLocale(lang, () => dishPreview(dish, lang));
}

const SEPARATOR = ' · ';

describe('dishPreview', () => {
	it('regional dish: the first two "Region · Variation" (paella, en)', async () => {
		const paella = dishIn('en', 'paella');
		const got = await previewOf('en', paella);
		const want = paella.variations
			.slice(0, 2)
			.flatMap((v) => [v.regionName, v.name])
			.join(SEPARATOR);
		expect(got, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`).toBe(want);
	});

	for (const lang of SPAIN_WIDE_LOCALES) {
		const label = SPAIN_WIDE_LABEL[lang];
		const want = ALLIOLI.variations.flatMap((v) => [label, v.name]).join(SEPARATOR);

		it(`${lang}: Spanish variations read "${want}" (allioli)`, async () => {
			const got = await previewOf(lang, dishIn(lang, 'allioli'));
			expect(got, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`).toBe(want);
		});
	}

	it('a dish with one Spanish variation: "Spanish · Arroz blanco con tomate"', async () => {
		const got = await previewOf('en', dishIn('en', 'arrozblanco'));
		expect(got).toBe(`Spanish${SEPARATOR}Arroz blanco con tomate`);
	});

	it('mixes a regional and a Spanish variation in API order', async () => {
		const [regional] = dishIn('es', 'tortilla').variations;
		const [spanish] = dishIn('es', 'allioli').variations;
		const got = await previewOf('es', { variations: [regional, spanish] });
		const want = [regional.regionName, regional.name, 'España', spanish.name].join(SEPARATOR);
		expect(got, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`).toBe(want);
	});
});
