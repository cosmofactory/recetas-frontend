import { describe, expect, it } from 'vitest';
import { composite, contrastRatio, parseColour } from './contrast';

// The test helper itself, against known WCAG values.
describe('contrast helper', () => {
	it('black on white is 21:1', () => {
		expect(contrastRatio(parseColour('#000000'), parseColour('#FFFFFF'))).toBeCloseTo(21, 5);
	});

	it('a colour on itself is 1:1', () => {
		expect(contrastRatio(parseColour('#C4552E'), parseColour('#c4552e'))).toBeCloseTo(1, 5);
	});

	it('#767676 on white is 4.54:1 (the AA reference grey)', () => {
		expect(contrastRatio(parseColour('#767676'), parseColour('#ffffff'))).toBeCloseTo(4.54, 2);
	});

	it('composites source-over', () => {
		const got = composite(parseColour('rgba(255, 255, 255, .5)'), parseColour('#000000'));
		expect(got).toEqual({ r: 127.5, g: 127.5, b: 127.5, a: 1 });
	});

	it('rejects a colour it cannot parse', () => {
		expect(() => parseColour('var(--ink)')).toThrow();
	});
});
