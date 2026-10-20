import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import bundle from '#lib/server/mock/content.bundle.json';
import { createMockSource } from '#lib/server/mock/mock-source.ts';
import { loadExport, repoFile } from '../../testutil/load-export';
import {
	MAP_COLUMNS,
	MAP_ROWS,
	type GridCell,
	type LabelPosition,
	type MapGrid,
	type ParseGrid
} from '../../testutil/map';

// FE-4 Map, the pure layer (stage FE-4 -> Map: "Write the pure functions
// first"). D-FE4-1: the layout is a bundled copy of the design map-grid.json
// at src/lib/map/map-grid.json; region order and colours still come from the
// API. Mobile README -> Map (shared): "Cell layout comes exactly from
// map-grid.json → grid (one string per row, one char per column; `.` =
// empty, letters map to region keys via `legend`). Canarias sits alone on the
// bottom-left row; Balears is a 2×2 block off the east coast." Labels sit "at
// the centroid of its cells plus labelNudges (in cell units)"; map-grid.json
// labelNudgeUnit: "grid cells, added to the centroid of the region cells
// (x, y)".
//
// Contract (src/lib/map/grid.ts):
// - parseGrid(mapGrid) -> Map<regionKey, GridCell[]>, cells in row-major
//   order, rows and columns 1-based (the CSS grid lines a cell is placed on).
//   It throws when the grid has the wrong number of rows, a row has the wrong
//   number of columns, a letter isn't in the legend, or a legend region has
//   no cells. The empty cell is the file's `emptyCell`, not a hard-coded '.'.
// - labelPosition(cells, nudge?) -> { x, y } in cell units from the map's
//   top-left corner: the mean of the cell centres (col − 0.5, row − 0.5) plus
//   the nudge [dx, dy]. This is the prototype's formula (both prototypes:
//   `sums[key].c += ci + 0.5`, `left: (m.c / m.n + dx) / 14`), so a label's
//   CSS left is x / columns and top y / rows. An empty cell list throws.

const GRID_MODULE = 'src/lib/map/grid.ts';
const APP_GRID = 'src/lib/map/map-grid.json';
const DESIGN_GRID = repoFile('../design/design_handoff_asadorov_desktop/map-grid.json');
const REAL_CELL_COUNT = 105;

const loadParseGrid = () => loadExport<ParseGrid>(GRID_MODULE, 'parseGrid');
const loadLabelPosition = () => loadExport<LabelPosition>(GRID_MODULE, 'labelPosition');

// A 4×3 grid: two regions sharing a column with an empty cell between them,
// one alone on the bottom row.
const SMALL: MapGrid = {
	columns: 4,
	rows: 3,
	legend: { A: 'gal', B: 'bal', C: 'can' },
	emptyCell: '.',
	grid: ['AA.B', 'A..B', 'CC..']
};

function withGrid(changes: Partial<MapGrid>): MapGrid {
	return { ...SMALL, ...changes };
}

function cells(...pairs: [number, number][]): GridCell[] {
	return pairs.map(([row, col]) => ({ row, col }));
}

function realGrid(): MapGrid {
	const file = repoFile(APP_GRID);
	expect(existsSync(file), `got no ${APP_GRID}, want the bundled copy (D-FE4-1)`).toBe(true);
	return JSON.parse(readFileSync(file, 'utf8')) as MapGrid;
}

function asObject(parsed: Map<string, GridCell[]>): Record<string, GridCell[]> {
	expect(parsed, 'want parseGrid to return a Map').toBeInstanceOf(Map);
	return Object.fromEntries(parsed);
}

describe('parseGrid', () => {
	it('returns each region’s cells, 1-based, in row-major order', async () => {
		const parseGrid = await loadParseGrid();
		const got = asObject(parseGrid(SMALL));
		expect(got).toEqual({
			gal: cells([1, 1], [1, 2], [2, 1]),
			bal: cells([1, 4], [2, 4]),
			can: cells([3, 1], [3, 2])
		});
	});

	it('produces nothing for empty cells', async () => {
		const parseGrid = await loadParseGrid();
		const all = [...parseGrid(SMALL).values()].flat();
		const got = all.length;
		expect(got, `got ${got} cells, want 7 (5 empty cells skipped)`).toBe(7);
	});

	it('reads the empty cell from the file’s emptyCell', async () => {
		const parseGrid = await loadParseGrid();
		const custom = withGrid({ emptyCell: '_', grid: ['AA_B', 'A__B', 'CC__'] });
		expect(asObject(parseGrid(custom))).toEqual(asObject(parseGrid(SMALL)));
	});

	const invalid: { name: string; grid: MapGrid; mentions: string }[] = [
		{ name: 'too few rows', grid: withGrid({ rows: 4 }), mentions: 'rows' },
		{ name: 'too many rows', grid: withGrid({ rows: 2 }), mentions: 'rows' },
		{
			name: 'a row with too few columns',
			grid: withGrid({ grid: ['AA.B', 'A.B', 'CC..'] }),
			mentions: 'columns'
		},
		{
			name: 'a row with too many columns',
			grid: withGrid({ grid: ['AA.B', 'A..B', 'CC...'] }),
			mentions: 'columns'
		},
		{
			name: 'a letter not in the legend',
			grid: withGrid({ grid: ['AA.B', 'A.XB', 'CC..'] }),
			mentions: 'X'
		},
		{
			name: 'a legend region without cells',
			grid: withGrid({ legend: { ...SMALL.legend, M: 'mad' } }),
			mentions: 'mad'
		}
	];
	for (const tc of invalid) {
		it(`throws for ${tc.name}, naming ${tc.mentions}`, async () => {
			const parseGrid = await loadParseGrid();
			expect(() => parseGrid(tc.grid)).toThrow(tc.mentions);
		});
	}
});

describe('labelPosition', () => {
	const cases: {
		name: string;
		cells: GridCell[];
		nudge?: number[];
		want: { x: number; y: number };
	}[] = [
		{ name: 'a single cell sits at its centre', cells: cells([1, 1]), want: { x: 0.5, y: 0.5 } },
		{
			name: 'Canarias alone on the bottom row (11, cols 1–4)',
			cells: cells([11, 1], [11, 2], [11, 3], [11, 4]),
			want: { x: 2, y: 10.5 }
		},
		{
			name: 'Balears as a 2×2 block (rows 5–6, cols 13–14)',
			cells: cells([5, 13], [5, 14], [6, 13], [6, 14]),
			want: { x: 13, y: 5 }
		},
		{
			name: 'an L-shaped region averages its cells, not its bounding box',
			cells: cells([1, 1], [1, 2], [2, 1]),
			want: { x: 4 / 3 - 0.5, y: 4 / 3 - 0.5 }
		},
		{
			name: 'a nudge adds [dx, dy] in cell units (gal: [-0.2, -0.5])',
			cells: cells([1, 2], [1, 3], [2, 1], [2, 2], [2, 3], [3, 1], [3, 2]),
			nudge: [-0.2, -0.5],
			want: { x: 1.5 - 0.2, y: 1.5 - 0.5 }
		},
		{
			name: 'no nudge is [0, 0]',
			cells: cells([5, 13], [5, 14], [6, 13], [6, 14]),
			nudge: undefined,
			want: { x: 13, y: 5 }
		}
	];
	for (const tc of cases) {
		it(tc.name, async () => {
			const labelPosition = await loadLabelPosition();
			const got = labelPosition(tc.cells, tc.nudge);
			expect(got.x, `got x ${got.x}, want ${tc.want.x}`).toBeCloseTo(tc.want.x, 6);
			expect(got.y, `got y ${got.y}, want ${tc.want.y}`).toBeCloseTo(tc.want.y, 6);
		});
	}

	it('throws for a region without cells', async () => {
		const labelPosition = await loadLabelPosition();
		expect(() => labelPosition([])).toThrow();
	});
});

describe('the bundled map-grid.json', () => {
	it(`is ${MAP_COLUMNS}×${MAP_ROWS} with aspect ratio 14 / 11`, () => {
		const grid = realGrid();
		expect(grid.columns).toBe(MAP_COLUMNS);
		expect(grid.rows).toBe(MAP_ROWS);
		expect(grid.aspectRatio).toBe('14 / 11');
	});

	it(`parses into ${REAL_CELL_COUNT} cells, every legend region with at least one`, async () => {
		const parseGrid = await loadParseGrid();
		const grid = realGrid();
		const parsed = parseGrid(grid);
		expect([...parsed.keys()].sort()).toEqual(Object.values(grid.legend).sort());
		const got = [...parsed.values()].flat().length;
		expect(got, `got ${got} cells, want ${REAL_CELL_COUNT}`).toBe(REAL_CELL_COUNT);
	});

	it('puts Canarias alone on the bottom-left row', async () => {
		const parseGrid = await loadParseGrid();
		const parsed = parseGrid(realGrid());
		expect(parsed.get('can')).toEqual(cells([11, 1], [11, 2], [11, 3], [11, 4]));
		const others = [...parsed].filter(([key]) => key !== 'can').flatMap(([, list]) => list);
		const onBottomRow = others.filter((cell) => cell.row === MAP_ROWS);
		expect(onBottomRow, 'got other regions on the bottom row').toEqual([]);
	});

	it('makes Balears a 2×2 block off the east coast', async () => {
		const parseGrid = await loadParseGrid();
		const parsed = parseGrid(realGrid());
		expect(parsed.get('bal')).toEqual(cells([5, 13], [5, 14], [6, 13], [6, 14]));
	});

	it('nudges only regions in the legend, by [dx, dy]', () => {
		const grid = realGrid();
		const regions = new Set(Object.values(grid.legend));
		for (const [key, nudge] of Object.entries(grid.labelNudges ?? {})) {
			expect(regions.has(key), `got a nudge for ${key}, not in the legend`).toBe(true);
			expect(nudge, `got nudge ${JSON.stringify(nudge)} for ${key}`).toHaveLength(2);
		}
	});

	it('places the Galicia label at its centroid plus its nudge', async () => {
		const parseGrid = await loadParseGrid();
		const labelPosition = await loadLabelPosition();
		const grid = realGrid();
		const got = labelPosition(parseGrid(grid).get('gal') ?? [], grid.labelNudges?.gal);
		expect(got.x).toBeCloseTo(1.3, 6);
		expect(got.y).toBeCloseTo(1, 6);
	});
});

// D-FE4-1: "A test checks that every legend key is a region key in the mock
// catalog". The reverse too: a catalog region missing from the grid would
// never be drawn.
describe('map-grid.json legend vs the catalog regions', () => {
	it('names exactly the regions the mock catalog serves', async () => {
		const regions = await createMockSource(bundle).listRegions('en');
		const catalogKeys = regions.map((region) => region.key).sort();
		const legendKeys = Object.values(realGrid().legend).sort();
		expect(legendKeys, `got legend ${legendKeys}, want catalog ${catalogKeys}`).toEqual(
			catalogKeys
		);
	});
});

// D-FE4-1: the bundled copy equals the design file byte for byte. The design
// bundle lives outside this repo, so this is skipped where it is absent (CI).
describe.skipIf(!existsSync(DESIGN_GRID))('the bundled copy vs the design file', () => {
	it(`${APP_GRID} is byte-identical to the design map-grid.json`, () => {
		const app = repoFile(APP_GRID);
		expect(existsSync(app), `got no ${APP_GRID}`).toBe(true);
		expect(readFileSync(app).equals(readFileSync(DESIGN_GRID)), 'got different bytes').toBe(true);
	});
});
