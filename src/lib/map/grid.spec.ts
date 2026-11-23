import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import bundle from '#lib/server/mock/content.bundle.json';
import { createMockSource } from '#lib/server/mock/mock-source.ts';
import { loadExport, repoFile } from '../../testutil/load-export';
import {
	MAP_ASPECT_RATIO,
	MAP_COLUMNS,
	MAP_ROWS,
	REGION_COUNT,
	type GridCell,
	type LabelCells,
	type LabelPosition,
	type MapGrid,
	type ParseGrid
} from '../../testutil/map';

// FE-4 Map, the pure layer (stage FE-4 -> Map: "Write the pure functions
// first"). D-FE4-1: the layout is a bundled copy of the design map-grid.json
// at src/lib/map/map-grid.json; region order and colours still come from the
// API. Mobile README -> Map (shared): "Cell layout comes exactly from
// map-grid.json → grid (one string per row, one char per column; `.` =
// empty, letters map to region keys via `legend`). Canarias is a 3-cell inset in
// the bottom-left corner (not to scale); Balears is a 2×2 block off the east
// coast." Labels sit "at
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
//
// Region revision (2026-11-23, both READMEs -> Map / Regional and
// "Revision — region coverage"): a 16 × 13 grid, 17 regions (Cantabria cnb,
// Navarra nav, La Rioja rio added), `regionOrder`, `insets` and `exclaves`.
// "Ceuta (K) and Melilla (W) are single squares across the sea from
// Andalucía and belong to it: same colour, tapping either selects
// Andalucía, and they follow its selected, hover and dimmed states. They
// carry no name labels and are left out of Andalucía's label centroid."
// Contract added for it (src/lib/map/grid.ts):
// - parseGrid keeps every legend letter's cells, exclaves included, under the
//   legend's region key (they are drawn and selected with the region), still
//   as plain { row, col } cells.
// - labelCells(mapGrid) -> Map<regionKey, GridCell[]>: the same, minus the
//   cells whose letter is a key of `exclaves`. A region's label is
//   labelPosition(labelCells.get(key), labelNudges[key]); a grid without
//   `exclaves` gives the same cells as parseGrid.

const GRID_MODULE = 'src/lib/map/grid.ts';
const APP_GRID = 'src/lib/map/map-grid.json';
const DESIGN_GRID = repoFile('../design/design_handoff_asadorov_desktop/map-grid.json');
const DESIGN_CONTENT = repoFile('../design/design_handoff_asadorov_desktop/content.json');
const REAL_CELL_COUNT = 129;

const loadParseGrid = () => loadExport<ParseGrid>(GRID_MODULE, 'parseGrid');
const loadLabelCells = () => loadExport<LabelCells>(GRID_MODULE, 'labelCells');
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

// The distinct region keys of the legend (exclave letters share theirs), sorted.
function legendRegions(grid: MapGrid): string[] {
	return [...new Set(Object.values(grid.legend))].sort();
}

// The cells drawn with one grid letter, 1-based, in row-major order.
function cellsOfLetter(grid: MapGrid, letter: string): GridCell[] {
	return grid.grid.flatMap((line, row) =>
		[...line].flatMap((char, col) => (char === letter ? [{ row: row + 1, col: col + 1 }] : []))
	);
}

// The mean of the cell centres, in cell units (no nudge).
function meanCentre(list: GridCell[]): { x: number; y: number } {
	const mean = (sum: number) => sum / list.length - 0.5;
	return {
		x: mean(list.reduce((sum, cell) => sum + cell.col, 0)),
		y: mean(list.reduce((sum, cell) => sum + cell.row, 0))
	};
}

// labelNudges in the revised design map-grid.json (gal and mad carried over).
const WANT_NUDGES = {
	gal: [-0.2, -0.5],
	ast: [0.2, -0.25],
	cnb: [0, 0.5],
	bas: [0.2, -0.33],
	nav: [0.3, 0.1],
	mad: [0, 0.3]
};

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

// SMALL plus an exclave: X is drawn as Galicia, apart from it, bottom right.
const WITH_EXCLAVE = withGrid({
	legend: { ...SMALL.legend, X: 'gal' },
	grid: ['AA.B', 'A..B', 'CC.X'],
	exclaves: { X: { name: 'Isla', regionKey: 'gal' } }
});

describe('parseGrid with an exclave', () => {
	it('draws the exclave cell as a plain cell of its region, in row-major order', async () => {
		const parseGrid = await loadParseGrid();
		const got = asObject(parseGrid(WITH_EXCLAVE));
		expect(got.gal).toEqual(cells([1, 1], [1, 2], [2, 1], [3, 4]));
	});
});

describe('labelCells', () => {
	it('gives the same cells as parseGrid when the grid has no exclaves', async () => {
		const parseGrid = await loadParseGrid();
		const labelCells = await loadLabelCells();
		expect(asObject(labelCells(SMALL))).toEqual(asObject(parseGrid(SMALL)));
	});

	it('leaves the exclave cells out of their region', async () => {
		const labelCells = await loadLabelCells();
		const got = asObject(labelCells(WITH_EXCLAVE));
		expect(got).toEqual({
			gal: cells([1, 1], [1, 2], [2, 1]),
			bal: cells([1, 4], [2, 4]),
			can: cells([3, 1], [3, 2])
		});
	});

	it('keeps the label at the mainland centroid', async () => {
		const labelCells = await loadLabelCells();
		const labelPosition = await loadLabelPosition();
		const got = labelPosition(labelCells(WITH_EXCLAVE).get('gal') ?? []);
		expect(got.x, `got x ${got.x}, want ${4 / 3 - 0.5}`).toBeCloseTo(4 / 3 - 0.5, 6);
		expect(got.y, `got y ${got.y}, want ${4 / 3 - 0.5}`).toBeCloseTo(4 / 3 - 0.5, 6);
	});
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
			name: 'Canarias as the bottom-left inset (row 12, cols 1–3)',
			cells: cells([12, 1], [12, 2], [12, 3]),
			want: { x: 1.5, y: 11.5 }
		},
		{
			name: 'Balears as a 2×2 block (rows 6–7, cols 15–16)',
			cells: cells([6, 15], [6, 16], [7, 15], [7, 16]),
			want: { x: 15, y: 6 }
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
			cells: cells([6, 15], [6, 16], [7, 15], [7, 16]),
			nudge: undefined,
			want: { x: 15, y: 6 }
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
	it(`is ${MAP_COLUMNS}×${MAP_ROWS} with aspect ratio ${MAP_ASPECT_RATIO}`, () => {
		const grid = realGrid();
		expect(grid.columns, `got ${grid.columns} columns, want ${MAP_COLUMNS}`).toBe(MAP_COLUMNS);
		expect(grid.rows, `got ${grid.rows} rows, want ${MAP_ROWS}`).toBe(MAP_ROWS);
		expect(grid.aspectRatio).toBe(MAP_ASPECT_RATIO);
	});

	it(`parses into ${REAL_CELL_COUNT} cells, every legend region with at least one`, async () => {
		const parseGrid = await loadParseGrid();
		const grid = realGrid();
		const parsed = parseGrid(grid);
		expect([...parsed.keys()].sort()).toEqual(legendRegions(grid));
		const got = [...parsed.values()].flat().length;
		expect(got, `got ${got} cells, want ${REAL_CELL_COUNT}`).toBe(REAL_CELL_COUNT);
	});

	it(`draws ${REGION_COUNT} regions, Cantabria, Navarra and La Rioja among them`, async () => {
		const parseGrid = await loadParseGrid();
		const keys = [...parseGrid(realGrid()).keys()];
		expect(keys, `got ${keys.length} regions: ${keys}`).toHaveLength(REGION_COUNT);
		for (const key of ['cnb', 'nav', 'rio']) expect(keys, `got no ${key}`).toContain(key);
	});

	it('puts Canarias as a 3-cell inset in the bottom-left corner', async () => {
		const parseGrid = await loadParseGrid();
		const parsed = parseGrid(realGrid());
		expect(parsed.get('can')).toEqual(cells([12, 1], [12, 2], [12, 3]));
	});

	it('makes Balears a 2×2 block off the east coast', async () => {
		const parseGrid = await loadParseGrid();
		const parsed = parseGrid(realGrid());
		expect(parsed.get('bal')).toEqual(cells([6, 15], [6, 16], [7, 15], [7, 16]));
	});

	it('lists Canarias and Balears as insets', () => {
		const insets = Object.keys(realGrid().insets ?? {}).sort();
		expect(insets, `got insets ${insets}`).toEqual(['bal', 'can']);
	});

	it('nudges only regions in the legend, by [dx, dy]', () => {
		const grid = realGrid();
		const regions = new Set(Object.values(grid.legend));
		for (const [key, nudge] of Object.entries(grid.labelNudges ?? {})) {
			expect(regions.has(key), `got a nudge for ${key}, not in the legend`).toBe(true);
			expect(nudge, `got nudge ${JSON.stringify(nudge)} for ${key}`).toHaveLength(2);
		}
	});

	it('nudges exactly gal, ast, cnb, bas, nav and mad, by the design’s values', () => {
		const got = realGrid().labelNudges;
		expect(got, `got nudges ${JSON.stringify(got)}`).toEqual(WANT_NUDGES);
	});

	it('places the Galicia label at its centroid plus its nudge', async () => {
		const labelCells = await loadLabelCells();
		const labelPosition = await loadLabelPosition();
		const grid = realGrid();
		const got = labelPosition(labelCells(grid).get('gal') ?? [], grid.labelNudges?.gal);
		expect(got.x, `got x ${got.x}, want 1.625 − 0.2`).toBeCloseTo(1.425, 6);
		expect(got.y, `got y ${got.y}, want 1.625 − 0.5`).toBeCloseTo(1.125, 6);
	});
});

// Ceuta (K) and Melilla (W): part of Andalucía, unlabelled, off its centroid.
describe('the exclaves in the bundled map-grid.json', () => {
	const EXCLAVES = [
		{ letter: 'K', name: 'Ceuta', cell: { row: 13, col: 7 } },
		{ letter: 'W', name: 'Melilla', cell: { row: 13, col: 10 } }
	];

	for (const { letter, name, cell } of EXCLAVES) {
		it(`maps ${name} (${letter}) to Andalucía in the legend and the exclaves`, () => {
			const grid = realGrid();
			expect(grid.legend[letter], `got legend ${letter} = ${grid.legend[letter]}`).toBe('and');
			expect(grid.exclaves?.[letter]).toEqual({ name, regionKey: 'and' });
		});

		it(`draws ${name} as Andalucía’s cell at row ${cell.row}, col ${cell.col}`, async () => {
			const parseGrid = await loadParseGrid();
			const andalucia = parseGrid(realGrid()).get('and') ?? [];
			expect(andalucia, `got Andalucía cells ${JSON.stringify(andalucia)}`).toContainEqual(cell);
		});

		it(`leaves ${name} out of Andalucía’s label cells`, async () => {
			const labelCells = await loadLabelCells();
			const andalucia = labelCells(realGrid()).get('and') ?? [];
			expect(andalucia, `got ${name} among the label cells`).not.toContainEqual(cell);
		});
	}

	it('gives Andalucía exactly its mainland D cells as label cells', async () => {
		const labelCells = await loadLabelCells();
		const grid = realGrid();
		expect(labelCells(grid).get('and')).toEqual(cellsOfLetter(grid, 'D'));
	});

	it('centres the Andalucía label on the mainland D cells only', async () => {
		const labelCells = await loadLabelCells();
		const labelPosition = await loadLabelPosition();
		const grid = realGrid();
		const want = meanCentre(cellsOfLetter(grid, 'D'));
		const got = labelPosition(labelCells(grid).get('and') ?? [], grid.labelNudges?.and);
		expect(got.x, `got x ${got.x}, want ${want.x} (mainland only)`).toBeCloseTo(want.x, 6);
		expect(got.y, `got y ${got.y}, want ${want.y} (mainland only)`).toBeCloseTo(want.y, 6);
	});

	it(`has label cells for exactly the ${REGION_COUNT} regions, none for an exclave letter`, async () => {
		const labelCells = await loadLabelCells();
		const grid = realGrid();
		const got = [...labelCells(grid).keys()].sort();
		expect(got, `got label regions ${got}`).toEqual(legendRegions(grid));
		expect(got).toHaveLength(REGION_COUNT);
		for (const { letter } of EXCLAVES)
			expect(got, `got a label for ${letter}`).not.toContain(letter);
	});

	it('keeps every region’s label cells inside its drawn cells, all but the exclaves', async () => {
		const parseGrid = await loadParseGrid();
		const labelCells = await loadLabelCells();
		const grid = realGrid();
		const labels = labelCells(grid);
		for (const [key, drawn] of parseGrid(grid)) {
			const exclaveCells = key === 'and' ? EXCLAVES.map((e) => e.cell) : [];
			const want = drawn.filter(
				(c) => !exclaveCells.some((e) => e.row === c.row && e.col === c.col)
			);
			expect(labels.get(key), `got ${key} label cells`).toEqual(want);
		}
	});
});

// "regions[] is in canonical region order (north to south, islands last),
// the same as map-grid.json → regionOrder" (both READMEs, data model).
describe('map-grid.json regionOrder', () => {
	it(`names each of the ${REGION_COUNT} legend regions exactly once`, () => {
		const grid = realGrid();
		const order = grid.regionOrder ?? [];
		expect(new Set(order).size, `got duplicates in ${order}`).toBe(order.length);
		expect([...order].sort(), `got regionOrder ${order}`).toEqual(legendRegions(grid));
	});

	it('is the order the mock catalog serves its regions in', async () => {
		const regions = await createMockSource(bundle).listRegions('en');
		const got = regions.map((region) => region.key);
		expect(got, `got catalog order ${got}`).toEqual(realGrid().regionOrder);
	});

	it.skipIf(!existsSync(DESIGN_CONTENT))('is the design content.json regions[] order', () => {
		const content = JSON.parse(readFileSync(DESIGN_CONTENT, 'utf8')) as {
			regions: { key: string }[];
		};
		expect(realGrid().regionOrder).toEqual(content.regions.map((region) => region.key));
	});
});

// D-FE4-1: "A test checks that every legend key is a region key in the mock
// catalog". The reverse too: a catalog region missing from the grid would
// never be drawn.
describe('map-grid.json legend vs the catalog regions', () => {
	it('names exactly the regions the mock catalog serves', async () => {
		const regions = await createMockSource(bundle).listRegions('en');
		const catalogKeys = regions.map((region) => region.key).sort();
		// Exclave letters (Ceuta, Melilla) share Andalucía's key, so compare distinct keys.
		const legendKeys = legendRegions(realGrid());
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
