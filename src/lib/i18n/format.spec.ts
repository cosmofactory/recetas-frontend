import { describe, expect, it } from 'vitest';
import { loadExport } from '../../testutil/load-export';

// FE-1: numbers use a decimal comma in es/ru ("1,2 kg"); unit labels come from
// strings.json -> units.

type FormatNumber = (locale: string, n: number, options?: Intl.NumberFormatOptions) => string;
type UnitLabel = (locale: string, unit: string) => string;

const MODULE = 'src/lib/i18n/format.ts';
const NBSP = ' ';

describe('formatNumber', () => {
	const cases: [string, number, string][] = [
		['en', 1.2, '1.2'],
		['es', 1.2, '1,2'],
		['ru', 1.2, '1,2'],
		['en', 1, '1'],
		['es', 1, '1'],
		['ru', 1, '1'],
		['en', 0.5, '0.5'],
		['es', 0.5, '0,5'],
		['ru', 0.5, '0,5'],
		// At most one fraction digit by default.
		['en', 1.25, '1.3'],
		['es', 1.25, '1,3'],
		['ru', 1.25, '1,3'],
		['en', 2.0, '2'],
		['es', 12.5, '12,5'],
		['en', 1234.5, '1,234.5'],
		['es', 1234.5, '1234,5'],
		['ru', 1234.5, `1${NBSP}234,5`]
	];
	for (const [locale, n, want] of cases) {
		it(`formatNumber(${locale}, ${n}) is ${JSON.stringify(want)}`, async () => {
			const formatNumber = await loadExport<FormatNumber>(MODULE, 'formatNumber');
			const got = formatNumber(locale, n);
			expect(got, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`).toBe(want);
		});
	}

	const withOptions: [string, number, Intl.NumberFormatOptions, string][] = [
		['en', 2, { minimumFractionDigits: 1 }, '2.0'],
		['ru', 2, { minimumFractionDigits: 1 }, '2,0'],
		['es', 1.26, { maximumFractionDigits: 2 }, '1,26'],
		['en', 1.6, { maximumFractionDigits: 0 }, '2']
	];
	for (const [locale, n, options, want] of withOptions) {
		it(`formatNumber(${locale}, ${n}, ${JSON.stringify(options)}) is ${want}`, async () => {
			const formatNumber = await loadExport<FormatNumber>(MODULE, 'formatNumber');
			const got = formatNumber(locale, n, options);
			expect(got, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`).toBe(want);
		});
	}
});

describe('unitLabel', () => {
	const cases: [string, string, string][] = [
		['en', 'g', 'g'],
		['en', 'ml', 'ml'],
		['en', 'kg', 'kg'],
		['en', 'L', 'L'],
		['en', 'tsp', 'tsp'],
		['es', 'g', 'g'],
		['es', 'ml', 'ml'],
		['es', 'kg', 'kg'],
		['es', 'L', 'L'],
		['es', 'tsp', 'cdta'],
		['ru', 'g', 'г'],
		['ru', 'ml', 'мл'],
		['ru', 'kg', 'кг'],
		['ru', 'L', 'л'],
		['ru', 'tsp', 'ч. л.']
	];
	for (const [locale, unit, want] of cases) {
		it(`unitLabel(${locale}, ${unit}) is ${want}`, async () => {
			const unitLabel = await loadExport<UnitLabel>(MODULE, 'unitLabel');
			const got = unitLabel(locale, unit);
			expect(got, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`).toBe(want);
		});
	}

	for (const unknown of ['cup', 'toString', 'constructor']) {
		it(`unitLabel(en, ${unknown}) throws as an unknown unit`, async () => {
			const unitLabel = await loadExport<UnitLabel>(MODULE, 'unitLabel');
			expect(() => unitLabel('en', unknown)).toThrow(new RegExp(unknown));
		});
	}
});
