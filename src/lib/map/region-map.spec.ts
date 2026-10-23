import { describe, expect, it } from 'vitest';
import type { CatalogRegion } from '#lib/api/catalog-region.ts';
import { shapedRegions, type RowSpan } from './region-map.ts';

// FE-8 PR 5a: a region whose cells reach the map's bottom row gets that run
// of cells as `shape.bottomEdge` (1-based CSS grid lines, end exclusive), so
// MapRegion can grow its target to 44px below the map, where no other region
// is. In map-grid.json only Canarias ("QQQQ" on row 11) sits on the bottom
// row; every other region gets null.

const BOTTOM_ROW = 11;
const ALL_KEYS = [
	'gal',
	'ast',
	'bas',
	'cat',
	'cyl',
	'mad',
	'ara',
	'val',
	'ext',
	'clm',
	'and',
	'mur',
	'bal',
	'can'
];

const region = (key: string) => ({ key }) as CatalogRegion;

function bottomEdgeOf(key: string): RowSpan | null | undefined {
	return shapedRegions([region(key)])[0]?.shape.bottomEdge;
}

describe('RegionShape.bottomEdge', () => {
	it('gives Canarias its bottom-row span (columns 1 to 4)', () => {
		const want: RowSpan = { row: BOTTOM_ROW, columnStart: 1, columnEnd: 5 };
		expect(bottomEdgeOf('can'), 'got a different span').toEqual(want);
	});

	for (const key of ALL_KEYS.filter((k) => k !== 'can')) {
		it(`is null for ${key} (no cell on the bottom row)`, () => {
			expect(bottomEdgeOf(key), `got ${JSON.stringify(bottomEdgeOf(key))}`).toBeNull();
		});
	}
});
