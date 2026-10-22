import { describe, expect, it } from 'vitest';
import { loadExport } from '../../testutil/load-export';

// FE-6 PR 1/4: recipe quantities scale linearly with servings and are shown
// per the prototype's `fmt` (desktop prototype L714-722) with the FE-6 small
// decisions: g/ml round to the nearest 10 before the kg/L switch and never show
// below 10; kg/L have at most one decimal and no trailing ".0"; counted units
// round half-up to the nearest ½, attached without a space ("1½ tsp").

type ScaleQuantity = (quantity: number, baseServings: number, servings: number) => number;
type FormatQuantity = (locale: string, value: number, unit: string | null) => string;

const MODULE = 'src/lib/recipe/quantity.ts';

type PerLocale = { en: string; es: string; ru: string };
type LocaleKey = keyof PerLocale;
const LOCALES: LocaleKey[] = ['en', 'es', 'ru'];

function same(text: string): PerLocale {
	return { en: text, es: text, ru: text };
}

async function formatQuantity(locale: string, value: number, unit: string | null) {
	const format = await loadExport<FormatQuantity>(MODULE, 'formatQuantity');
	return format(locale, value, unit);
}

async function scaleQuantity(quantity: number, baseServings: number, servings: number) {
	const scale = await loadExport<ScaleQuantity>(MODULE, 'scaleQuantity');
	return scale(quantity, baseServings, servings);
}

function expectText(got: string, want: string) {
	expect(got, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`).toBe(want);
}

describe('scaleQuantity', () => {
	// [quantity, baseServings, servings, want]
	const cases: [number, number, number, number][] = [
		[4, 4, 2, 2],
		[4, 2, 1, 2],
		[1, 4, 1, 0.25],
		[250, 2, 10, 1250],
		[400, 2, 6, 1200],
		[1, 2, 3, 1.5],
		[400, 4, 4, 400],
		// Raw: no rounding, the formatter rounds.
		[100, 3, 1, 100 / 3],
		[123, 1, 1, 123]
	];
	for (const [quantity, base, servings, want] of cases) {
		it(`scales ${quantity} from ${base} to ${servings} servings to ${want}`, async () => {
			const got = await scaleQuantity(quantity, base, servings);
			expect(got, `got ${got}, want ${want}`).toBeCloseTo(want, 10);
		});
	}
});

type ScaledCase = {
	name: string;
	quantity: number;
	baseServings: number;
	servings: number;
	unit: string | null;
	want: PerLocale;
};

describe('scaleQuantity + formatQuantity (FE-6 table)', () => {
	const cases: ScaledCase[] = [
		{
			name: '4 eggs halved',
			quantity: 4,
			baseServings: 4,
			servings: 2,
			unit: null,
			want: same('2')
		},
		{
			name: '4 eggs scaled to 1 serving from 2',
			quantity: 4,
			baseServings: 2,
			servings: 1,
			unit: null,
			want: same('2')
		},
		{
			name: '1 egg scaled to 1 serving from 4 is floored at 1 counted item',
			quantity: 1,
			baseServings: 4,
			servings: 1,
			unit: null,
			want: same('1')
		},
		{
			name: '250 ml ×5 switches to litres with one decimal',
			quantity: 250,
			baseServings: 2,
			servings: 10,
			unit: 'ml',
			want: { en: '1.3 L', es: '1,3 L', ru: '1,3 л' }
		},
		{
			name: '400 g ×3 switches to kilograms with one decimal',
			quantity: 400,
			baseServings: 2,
			servings: 6,
			unit: 'g',
			want: { en: '1.2 kg', es: '1,2 kg', ru: '1,2 кг' }
		},
		{
			name: '1 tsp ×1.5 shows a half attached to the whole part',
			quantity: 1,
			baseServings: 2,
			servings: 3,
			unit: 'tsp',
			want: { en: '1½ tsp', es: '1½ cdta', ru: '1½ ч. л.' }
		},
		{
			name: '1200 ml at base servings',
			quantity: 1200,
			baseServings: 6,
			servings: 6,
			unit: 'ml',
			want: { en: '1.2 L', es: '1,2 L', ru: '1,2 л' }
		}
	];
	for (const c of cases) {
		for (const locale of LOCALES) {
			it(`${c.name} (${locale}): ${c.want[locale]}`, async () => {
				const scaled = await scaleQuantity(c.quantity, c.baseServings, c.servings);
				expectText(await formatQuantity(locale, scaled, c.unit), c.want[locale]);
			});
		}
	}
});

type FormatCase = { name: string; value: number; unit: string | null; want: PerLocale };

describe('formatQuantity', () => {
	const cases: FormatCase[] = [
		// Counted units: nearest ½, half-up on 2q (so 0.75 -> 1, not ½).
		{
			name: '0.75 tsp rounds half-up to 1 (2q = 1.5 rounds to 2)',
			value: 0.75,
			unit: 'tsp',
			want: { en: '1 tsp', es: '1 cdta', ru: '1 ч. л.' }
		},
		{
			name: '0.25 tsp rounds half-up to ½ with no whole part',
			value: 0.25,
			unit: 'tsp',
			want: { en: '½ tsp', es: '½ cdta', ru: '½ ч. л.' }
		},
		{
			name: '0.2 tsp rounds to 0 and is lifted to 1',
			value: 0.2,
			unit: 'tsp',
			want: { en: '1 tsp', es: '1 cdta', ru: '1 ч. л.' }
		},
		{
			name: '1.25 tsp rounds half-up to 1½',
			value: 1.25,
			unit: 'tsp',
			want: { en: '1½ tsp', es: '1½ cdta', ru: '1½ ч. л.' }
		},
		{
			name: '1.75 tsp rounds half-up to 2',
			value: 1.75,
			unit: 'tsp',
			want: { en: '2 tsp', es: '2 cdta', ru: '2 ч. л.' }
		},
		// Bare counts (unit null): the same ½ steps, no unit label.
		{ name: 'bare count 2.5 shows 2½', value: 2.5, unit: null, want: same('2½') },
		{ name: 'bare count 1.24 rounds down to 1', value: 1.24, unit: null, want: same('1') },
		{ name: 'bare count 3 stays 3', value: 3, unit: null, want: same('3') },
		{ name: 'bare count 0.2 is floored at 1', value: 0.2, unit: null, want: same('1') },
		{ name: 'bare count 0.25 is floored at 1', value: 0.25, unit: null, want: same('1') },
		// g/ml: nearest 10, half-up.
		{
			name: '123 g rounds down to the nearest 10',
			value: 123,
			unit: 'g',
			want: { en: '120 g', es: '120 g', ru: '120 г' }
		},
		{
			name: '125 g rounds half-up to the nearest 10',
			value: 125,
			unit: 'g',
			want: { en: '130 g', es: '130 g', ru: '130 г' }
		},
		{
			name: '80 ml stays in millilitres',
			value: 80,
			unit: 'ml',
			want: { en: '80 ml', es: '80 ml', ru: '80 мл' }
		},
		{
			name: '994 g rounds to 990 g and stays in grams',
			value: 994,
			unit: 'g',
			want: { en: '990 g', es: '990 g', ru: '990 г' }
		},
		{
			name: '4 g never shows below 10 g',
			value: 4,
			unit: 'g',
			want: { en: '10 g', es: '10 g', ru: '10 г' }
		},
		{
			name: '2 ml never shows below 10 ml',
			value: 2,
			unit: 'ml',
			want: { en: '10 ml', es: '10 ml', ru: '10 мл' }
		},
		// kg/L: rounded to 10 first, then switched; no trailing ".0".
		{
			name: '996 g rounds to 1000 before the switch and shows 1 kg',
			value: 996,
			unit: 'g',
			want: { en: '1 kg', es: '1 kg', ru: '1 кг' }
		},
		{
			name: '1000 g shows 1 kg without a trailing .0',
			value: 1000,
			unit: 'g',
			want: { en: '1 kg', es: '1 kg', ru: '1 кг' }
		},
		{
			name: '1000 ml shows 1 L without a trailing .0',
			value: 1000,
			unit: 'ml',
			want: { en: '1 L', es: '1 L', ru: '1 л' }
		},
		{
			name: '2500 g shows 2.5 kg',
			value: 2500,
			unit: 'g',
			want: { en: '2.5 kg', es: '2,5 kg', ru: '2,5 кг' }
		},
		// The kg/L decimal comes from the raw value; rounding to 10 only decides the switch.
		{
			name: '1249 g takes its decimal from the raw value (no double rounding via 1250)',
			value: 1249,
			unit: 'g',
			want: { en: '1.2 kg', es: '1,2 kg', ru: '1,2 кг' }
		},
		{
			name: '1251 g rounds its raw decimal up to 1.3 kg',
			value: 1251,
			unit: 'g',
			want: { en: '1.3 kg', es: '1,3 kg', ru: '1,3 кг' }
		},
		{
			name: '995 g rounds to 1000 for the switch and shows 1 kg',
			value: 995,
			unit: 'g',
			want: { en: '1 kg', es: '1 kg', ru: '1 кг' }
		},
		{ name: 'bare count 0.5 is floored at 1', value: 0.5, unit: null, want: same('1') }
	];
	for (const c of cases) {
		for (const locale of LOCALES) {
			it(`${c.name} (${locale}): ${c.want[locale]}`, async () => {
				expectText(await formatQuantity(locale, c.value, c.unit), c.want[locale]);
			});
		}
	}

	it('throws on an unknown unit', async () => {
		const format = await loadExport<FormatQuantity>(MODULE, 'formatQuantity');
		expect(() => format('en', 2, 'cup')).toThrow(/cup/);
	});

	for (const inherited of ['toString', 'constructor']) {
		it(`throws on the inherited Object.prototype key ${inherited} as an unknown unit`, async () => {
			const format = await loadExport<FormatQuantity>(MODULE, 'formatQuantity');
			expect(() => format('en', 1, inherited)).toThrow(new RegExp(inherited));
		});
	}
});
