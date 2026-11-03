import { describe, expect, it } from 'vitest';
import type { BundleDish, BundleVariation } from './bundle.ts';
import { byDisplayOrder, regionRanks } from './importance.ts';

// Mirrors the backend's BE-7 ordering (stack.md X15) for DATA_SOURCE=mock.

const text = { en: 'x', es: 'x', ru: 'x' };

function variation(recipeKey: string, regionKey: string, score?: number): BundleVariation {
	return { recipeKey, regionKey, name: text, description: text, photos: null, score };
}

function dish(key: string, variations: BundleVariation[]): BundleDish {
	return { key, variations } as unknown as BundleDish;
}

const keys = (dishes: BundleDish[]) => dishes.map((d) => d.key);

describe('byDisplayOrder', () => {
	it('keeps bundle order when nothing is scored', () => {
		const dishes = [dish('a', [variation('a-gal', 'gal')]), dish('b', [variation('b-gal', 'gal')])];
		expect(keys(byDisplayOrder(dishes))).toEqual(['a', 'b']);
	});

	it('orders by the sum of variation scores', () => {
		const dishes = [
			dish('a', [variation('a-gal', 'gal', 3)]),
			dish('b', [variation('b-gal', 'gal', 2), variation('b-ast', 'ast', 2)])
		];
		expect(keys(byDisplayOrder(dishes))).toEqual(['b', 'a']);
	});

	it('keeps bundle order on a tie that float addition would break (0.1 + 0.7 vs 0.8)', () => {
		const dishes = [
			dish('a', [variation('a-gal', 'gal', 0.1), variation('a-ast', 'ast', 0.7)]),
			dish('b', [variation('b-gal', 'gal', 0.8)])
		];
		expect(keys(byDisplayOrder(dishes))).toEqual(['a', 'b']);
	});
});

describe('regionRanks', () => {
	it('ranks each region by variation score, then dish order', () => {
		const dishes = [
			dish('a', [variation('a-gal', 'gal'), variation('a-ast', 'ast', 1)]),
			dish('b', [variation('b-gal', 'gal', 5), variation('b-ast', 'ast', 1)]),
			dish('c', [variation('c-gal', 'gal')])
		];
		expect(Object.fromEntries(regionRanks(dishes))).toEqual({
			'b-gal': 1,
			'a-gal': 2,
			'c-gal': 3,
			'a-ast': 1,
			'b-ast': 2
		});
	});
});
