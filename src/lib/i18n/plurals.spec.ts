import { describe, expect, it } from 'vitest';
import { loadExport } from '../../testutil/load-export';

// FE-1 / stack.md F7: plurals use CLDR categories via the compiled Paraglide
// messages; the message includes the number, so nothing is concatenated.

type PluralMessage = (inputs: { count: number }, options: { locale: string }) => string;
type Messages = Record<string, PluralMessage>;

const loadMessages = () => loadExport<Messages>('src/lib/paraglide/messages.js', 'm');

const COUNTS = [0, 1, 2, 5, 11, 21, 101] as const;

const WANT: Record<string, Record<string, readonly string[]>> = {
	home_variation: {
		en: [
			'0 variations',
			'1 variation',
			'2 variations',
			'5 variations',
			'11 variations',
			'21 variations',
			'101 variations'
		],
		es: [
			'0 variantes',
			'1 variante',
			'2 variantes',
			'5 variantes',
			'11 variantes',
			'21 variantes',
			'101 variantes'
		],
		ru: [
			'0 вариантов',
			'1 вариант',
			'2 варианта',
			'5 вариантов',
			'11 вариантов',
			'21 вариант',
			'101 вариант'
		]
	},
	home_dish: {
		en: ['0 dishes', '1 dish', '2 dishes', '5 dishes', '11 dishes', '21 dishes', '101 dishes'],
		es: ['0 platos', '1 plato', '2 platos', '5 platos', '11 platos', '21 platos', '101 platos'],
		ru: ['0 блюд', '1 блюдо', '2 блюда', '5 блюд', '11 блюд', '21 блюдо', '101 блюдо']
	}
};

// The stage file's own examples: 3 варианта, 13 вариантов, 22 варианта, 111 вариантов.
const RU_EXTRA: [number, string][] = [
	[3, '3 варианта'],
	[4, '4 варианта'],
	[12, '12 вариантов'],
	[13, '13 вариантов'],
	[14, '14 вариантов'],
	[22, '22 варианта'],
	[111, '111 вариантов']
];

describe('compiled plural messages', () => {
	for (const [key, byLocale] of Object.entries(WANT)) {
		for (const [locale, forms] of Object.entries(byLocale)) {
			it(`${key} in ${locale} for ${COUNTS.join(', ')}`, async () => {
				const message = (await loadMessages())[key];
				expect(message, `got no compiled message ${key}`).toBeTypeOf('function');
				const got = COUNTS.map((count) => message({ count }, { locale }));
				expect(got, `got ${JSON.stringify(got)}, want ${JSON.stringify(forms)}`).toEqual(forms);
			});
		}
	}

	for (const [count, want] of RU_EXTRA) {
		it(`home_variation in ru for ${count} is ${want}`, async () => {
			const message = (await loadMessages()).home_variation;
			expect(message, 'got no compiled message home_variation').toBeTypeOf('function');
			const got = message({ count }, { locale: 'ru' });
			expect(got, `got ${got}, want ${want}`).toBe(want);
		});
	}

	// CLDR gives es a `many` category (1000000, 1e6 multiples); strings.json has
	// only one/other, so `many` must render the `other` form, not the key name.
	for (const count of [1000000, 2000000]) {
		it(`home_variation in es for ${count} uses the other form`, async () => {
			const message = (await loadMessages()).home_variation;
			expect(message, 'got no compiled message home_variation').toBeTypeOf('function');
			const got = message({ count }, { locale: 'es' });
			expect(got, `got ${got}, want not the bare key`).not.toBe('home_variation');
			expect(got, `got ${got}, want it to contain "variantes"`).toContain('variantes');
		});
	}
});
