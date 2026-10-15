import { describe, expect, it } from 'vitest';
import { loadExport } from '../../testutil/load-export';

// FE-1: the three locales, in menu order, and a type guard for untrusted input.

const MODULE = 'src/lib/i18n/locales.ts';

describe('locales', () => {
	it('are en, es and ru in that order', async () => {
		const got = await loadExport<readonly string[]>(MODULE, 'locales');
		expect(got, `got ${JSON.stringify(got)}, want ["en","es","ru"]`).toEqual(['en', 'es', 'ru']);
	});
});

describe('isLocale', () => {
	const cases: [unknown, boolean][] = [
		['en', true],
		['es', true],
		['ru', true],
		['EN', false],
		['Es', false],
		['fr', false],
		['xx', false],
		['en-US', false],
		[' ru', false],
		['', false],
		[undefined, false],
		[null, false],
		[1, false]
	];
	for (const [input, want] of cases) {
		it(`isLocale(${JSON.stringify(input)}) is ${want}`, async () => {
			const isLocale = await loadExport<(x: unknown) => boolean>(MODULE, 'isLocale');
			const got = isLocale(input);
			expect(got, `got ${got}, want ${want}`).toBe(want);
		});
	}
});
