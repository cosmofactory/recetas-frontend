import { describe, expect, it } from 'vitest';
import type { Locale } from '#lib/i18n/locales.ts';
import { withRequestLocale } from '#lib/server/request-locale.ts';
import { loadExport } from '../../testutil/load-export';
import { SPAIN_WIDE_LABEL } from '../../testutil/spain-wide';

// FE-11, the region-slot rule (both READMEs -> "Spanish (Spain-wide)
// variations (2026-11-23)"; BE-9 D-ESP-3): wherever a region name is shown,
// a Spanish variation (regionKey "esp", regionName null from the API) shows
// the Spanish term, strings.json -> spainWide.label (Spanish / España /
// Испания), in its place.
//
// Decisions pinned here:
// - Module src/lib/content/variation-place.ts exports
//   variationPlace(variation, locale): string, where variation carries
//   { regionKey, regionName } (a VariationSummary or a Recipe). The locale is
//   explicit, like variationTitle, so server renders and Node tests need no
//   ambient locale.
// - The term is the Paraglide message spainWide_label, never a literal and
//   never the design content.json's spainWide.name (design data only).
// - A regional variation gets its regionName exactly as the API sent it.
// - The key decides, not the null: an esp variation is Spanish even if a
//   regionName were sent.

type Placed = { regionKey: string; regionName: string | null };
type VariationPlace = (variation: Placed, locale: Locale) => string;

const MODULE = 'src/lib/content/variation-place.ts';
const LOCALES: Locale[] = ['en', 'es', 'ru'];

const loadPlace = () => loadExport<VariationPlace>(MODULE, 'variationPlace');

type Case = { why: string; locale: Locale; variation: Placed; want: string };

const REGIONAL: Case[] = [
	{
		why: 'a regional variation names its region (en)',
		locale: 'en',
		variation: { regionKey: 'gal', regionName: 'Galicia' },
		want: 'Galicia'
	},
	{
		why: 'keeps the accents of the region name (es)',
		locale: 'es',
		variation: { regionKey: 'and', regionName: 'Andalucía' },
		want: 'Andalucía'
	},
	{
		why: 'keeps the translated region name (ru)',
		locale: 'ru',
		variation: { regionKey: 'bas', regionName: 'Страна Басков' },
		want: 'Страна Басков'
	}
];

const SPANISH: Case[] = LOCALES.flatMap((locale) => [
	{
		why: `a Spanish variation reads "${SPAIN_WIDE_LABEL[locale]}" (${locale})`,
		locale,
		variation: { regionKey: 'esp', regionName: null },
		want: SPAIN_WIDE_LABEL[locale]
	},
	{
		why: `the esp key wins over a stray regionName (${locale})`,
		locale,
		variation: { regionKey: 'esp', regionName: 'Galicia' },
		want: SPAIN_WIDE_LABEL[locale]
	}
]);

describe('variationPlace: the region slot', () => {
	for (const tc of [...REGIONAL, ...SPANISH]) {
		it(tc.why, async () => {
			const variationPlace = await loadPlace();
			const got = variationPlace(tc.variation, tc.locale);
			expect(got, `got ${JSON.stringify(got)}, want ${JSON.stringify(tc.want)}`).toBe(tc.want);
		});
	}

	it('follows the explicit locale, not the request locale', async () => {
		const variationPlace = await loadPlace();
		const spanish = { regionKey: 'esp', regionName: null };
		const got = withRequestLocale('en', () => variationPlace(spanish, 'ru'));
		expect(got).toBe(SPAIN_WIDE_LABEL.ru);
	});
});
