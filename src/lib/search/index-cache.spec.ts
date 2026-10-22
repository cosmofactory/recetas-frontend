import { describe, expect, it } from 'vitest';
import { cachedIndexBuilder } from './index-cache.ts';
import { buildIndex } from './search-index.ts';
import { mockCatalog } from '../../testutil/search';

// FE-7 PR 2 review: the home screen asks for the search index on every read
// while the overlay is open, so cachedIndexBuilder memoises buildIndex on
// its inputs. Pinned here: the cache key is the locale plus the identity of
// the two lists (not of the catalog wrapper, and not deep equality), and a
// hit returns the very same array.

describe('cachedIndexBuilder', () => {
	it('returns the same index for the same locale and the same lists', () => {
		const indexFor = cachedIndexBuilder();
		const catalog = mockCatalog('en');
		const first = indexFor(catalog, 'en');
		expect(indexFor(catalog, 'en'), 'got a rebuilt index, want the cached one').toBe(first);
	});

	it('reuses the index for a new catalog object holding the same lists', () => {
		const indexFor = cachedIndexBuilder();
		const catalog = mockCatalog('en');
		const first = indexFor(catalog, 'en');
		const rewrapped = { regions: catalog.regions, dishes: catalog.dishes };
		expect(indexFor(rewrapped, 'en'), 'got a rebuild for a new wrapper').toBe(first);
	});

	it('rebuilds for a different locale, in that locale', () => {
		const indexFor = cachedIndexBuilder();
		const catalog = mockCatalog('ru');
		const first = indexFor(catalog, 'en');
		const second = indexFor(catalog, 'ru');
		expect(second, 'got the en index for ru').not.toBe(first);
		expect(second).toEqual(buildIndex(catalog, 'ru'));
	});

	const newLists = [
		{ what: 'a new regions list', swap: (c: Catalog) => ({ ...c, regions: [...c.regions] }) },
		{ what: 'a new dishes list', swap: (c: Catalog) => ({ ...c, dishes: [...c.dishes] }) }
	];
	for (const { what, swap } of newLists) {
		it(`rebuilds for ${what}, even with equal contents`, () => {
			const indexFor = cachedIndexBuilder();
			const catalog = mockCatalog('en');
			const first = indexFor(catalog, 'en');
			const second = indexFor(swap(catalog), 'en');
			expect(second, `got the cached index for ${what}`).not.toBe(first);
			expect(second).toEqual(first);
		});
	}

	it('rebuilds with the new lists, not the cached ones', () => {
		const indexFor = cachedIndexBuilder();
		const catalog = mockCatalog('en');
		indexFor(catalog, 'en');
		const fewer = { regions: catalog.regions.slice(0, 1), dishes: catalog.dishes.slice(0, 1) };
		expect(indexFor(fewer, 'en')).toEqual(buildIndex(fewer, 'en'));
	});

	it('keeps separate caches per builder', () => {
		const catalog = mockCatalog('en');
		const first = cachedIndexBuilder()(catalog, 'en');
		expect(cachedIndexBuilder()(catalog, 'en'), 'got a cache shared across builders').not.toBe(
			first
		);
	});
});

type Catalog = ReturnType<typeof mockCatalog>;
