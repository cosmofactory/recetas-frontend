import { describe, expect, it } from 'vitest';
import type { CatalogRegion } from '#lib/api/catalog-region.ts';
import { mapSize, shapedRegions, type RegionShape, type RowSpan } from './region-map.ts';

// FE-8 PR 5a: a region whose bottom run of cells has only sea below it, to
// the map's bottom edge, gets that run as `shape.bottomEdge` (1-based CSS
// grid lines, end exclusive), so MapRegion can grow its target to 44px
// downward, where no other region is. Region revision (2026-11-23): Canarias
// is now a 3-cell inset on row 12 of 13 (row 13 under it is sea), and the
// bottom row holds only Andalucía's exclaves, Ceuta and Melilla, which are
// part of a large region and need no extension. So Canarias keeps its
// extension and every other region, Andalucía included, gets null.
//
// Labels (both READMEs -> Map): one per region "at the centroid of its cells
// plus labelNudges (in cell units)", the exclaves "left out of Andalucía's
// label centroid"; `shape.label` is that point as CSS percentages of the map
// box (x / columns, y / rows).

const MAP_COLUMNS = 16;
const MAP_ROWS = 13;
const CANARIAS_ROW = 12;
const REGION_ORDER = [
	'gal',
	'ast',
	'cnb',
	'bas',
	'nav',
	'rio',
	'cat',
	'cyl',
	'mad',
	'ara',
	'val',
	'ext',
	'clm',
	'mur',
	'and',
	'bal',
	'can'
];
const CEUTA = { row: 13, col: 7 };
const MELILLA = { row: 13, col: 10 };

// The mainland Andalucía (D) cells' centroid, in cell units: 19 cells.
const ANDALUCIA_MAINLAND = { x: 113.5 / 19, y: 188.5 / 19 };

// Centroid (cell units) plus the design's nudge, for the six nudged regions.
const NUDGED: { key: string; want: { x: number; y: number } }[] = [
	{ key: 'gal', want: { x: 1.625 - 0.2, y: 1.625 - 0.5 } },
	{ key: 'ast', want: { x: 4.25 + 0.2, y: 0.75 - 0.25 } },
	{ key: 'cnb', want: { x: 7, y: 1 + 0.5 } },
	{ key: 'bas', want: { x: 26.5 / 3 + 0.2, y: 2.5 / 3 - 0.33 } },
	{ key: 'nav', want: { x: 10 + 0.3, y: 1.5 + 0.1 } },
	{ key: 'mad', want: { x: 6.7, y: 5.1 + 0.3 } }
];

const region = (key: string) => ({ key }) as CatalogRegion;

function shapeOf(key: string): RegionShape {
	const shape = shapedRegions([region(key)])[0]?.shape;
	expect(shape, `got no shape for ${key}`).toBeDefined();
	return shape!;
}

function bottomEdgeOf(key: string): RowSpan | null | undefined {
	return shapedRegions([region(key)])[0]?.shape.bottomEdge;
}

function percent(value: string): number {
	expect(value, `got ${value}, want a CSS percentage`).toMatch(/%$/);
	return parseFloat(value);
}

function expectLabelAt(key: string, want: { x: number; y: number }) {
	const { left, top } = shapeOf(key).label;
	const wantLeft = (want.x / MAP_COLUMNS) * 100;
	const wantTop = (want.y / MAP_ROWS) * 100;
	expect(percent(left), `got ${key} left ${left}, want ${wantLeft}%`).toBeCloseTo(wantLeft, 4);
	expect(percent(top), `got ${key} top ${top}, want ${wantTop}%`).toBeCloseTo(wantTop, 4);
}

describe('mapSize', () => {
	it(`is ${MAP_COLUMNS} columns × ${MAP_ROWS} rows`, () => {
		expect(mapSize).toEqual({ columns: MAP_COLUMNS, rows: MAP_ROWS });
	});
});

describe('shapedRegions over the 17 regions', () => {
	it('shapes every region of the canonical order, in the order given', () => {
		const got = shapedRegions(REGION_ORDER.map(region)).map((r) => r.key);
		expect(got, `got ${got}`).toEqual(REGION_ORDER);
	});

	it('gives each region exactly one label', () => {
		for (const key of REGION_ORDER) {
			const { label } = shapeOf(key);
			expect(label, `got ${JSON.stringify(label)} for ${key}`).toEqual({
				left: expect.any(String),
				top: expect.any(String)
			});
		}
	});
});

describe('Andalucía and its exclaves', () => {
	it('draws Ceuta and Melilla among Andalucía’s cells, so either selects it', () => {
		const { cells } = shapeOf('and');
		expect(cells, 'got no Ceuta cell').toContainEqual(CEUTA);
		expect(cells, 'got no Melilla cell').toContainEqual(MELILLA);
	});

	it('places the Andalucía label on the mainland centroid, not pulled toward the exclaves', () => {
		expectLabelAt('and', ANDALUCIA_MAINLAND);
	});
});

describe('label nudges', () => {
	for (const { key, want } of NUDGED) {
		it(`places the ${key} label at its centroid plus its nudge`, () => {
			expectLabelAt(key, want);
		});
	}

	it('places an unnudged region (Canarias) at its plain centroid', () => {
		expectLabelAt('can', { x: 1.5, y: 11.5 });
	});
});

describe('RegionShape.bottomEdge', () => {
	it(`gives Canarias its row-${CANARIAS_ROW} span (columns 1 to 3), only sea below it`, () => {
		const want: RowSpan = { row: CANARIAS_ROW, columnStart: 1, columnEnd: 4 };
		expect(bottomEdgeOf('can'), 'got a different span').toEqual(want);
	});

	for (const key of REGION_ORDER.filter((k) => k !== 'can')) {
		it(`is null for ${key}`, () => {
			expect(bottomEdgeOf(key), `got ${JSON.stringify(bottomEdgeOf(key))}`).toBeNull();
		});
	}
});
