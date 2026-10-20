// The Spain mosaic layout (D-FE4-1): map-grid.json is one string per row, one
// character per column; legend letters name regions, `emptyCell` is sea.

export type MapGrid = {
	columns: number;
	rows: number;
	aspectRatio?: string;
	legend: Record<string, string>;
	emptyCell: string;
	grid: string[];
	labelNudges?: Record<string, number[]>;
	labelNudgeUnit?: string;
};

// 1-based CSS grid lines (grid-row-start / grid-column-start).
export type GridCell = { row: number; col: number };

// Cell units from the map's top-left corner: (0, 0) .. (columns, rows).
export type LabelPoint = { x: number; y: number };

const NO_NUDGE = [0, 0] as const;
// A cell's centre is half a cell past its 0-based start line.
const CELL_CENTRE = 0.5;

function checkShape(mapGrid: MapGrid) {
	if (mapGrid.grid.length !== mapGrid.rows) {
		throw new Error(`map grid: got ${mapGrid.grid.length} rows, want rows = ${mapGrid.rows}`);
	}
	mapGrid.grid.forEach((line, index) => {
		if (line.length === mapGrid.columns) return;
		throw new Error(
			`map grid: row ${index + 1} has ${line.length} columns, want columns = ${mapGrid.columns}`
		);
	});
}

function regionAt(mapGrid: MapGrid, letter: string, cell: GridCell): string {
	const key = mapGrid.legend[letter];
	if (key === undefined) {
		throw new Error(
			`map grid: letter ${letter} at row ${cell.row}, col ${cell.col} isn't in the legend`
		);
	}
	return key;
}

function checkEveryRegionDrawn(mapGrid: MapGrid, cells: Map<string, GridCell[]>) {
	const missing = Object.values(mapGrid.legend).filter((key) => !cells.has(key));
	if (missing.length > 0) throw new Error(`map grid: legend regions without cells: ${missing}`);
}

// Each region's cells in row-major order, on 1-based grid lines.
export function parseGrid(mapGrid: MapGrid): Map<string, GridCell[]> {
	checkShape(mapGrid);
	const cells = new Map<string, GridCell[]>();
	mapGrid.grid.forEach((line, rowIndex) => {
		[...line].forEach((letter, colIndex) => {
			if (letter === mapGrid.emptyCell) return;
			const cell = { row: rowIndex + 1, col: colIndex + 1 };
			const key = regionAt(mapGrid, letter, cell);
			cells.set(key, [...(cells.get(key) ?? []), cell]);
		});
	});
	checkEveryRegionDrawn(mapGrid, cells);
	return cells;
}

// The mean of the cell centres plus the nudge [dx, dy], in cell units (the
// prototypes' formula; CSS left is x / columns, top y / rows).
export function labelPosition(cells: GridCell[], nudge: readonly number[] = NO_NUDGE): LabelPoint {
	if (cells.length === 0) throw new Error('map label: a region needs at least one cell');
	const [dx = 0, dy = 0] = nudge;
	const mean = (sum: number) => sum / cells.length - CELL_CENTRE;
	const x = mean(cells.reduce((sum, cell) => sum + cell.col, 0));
	const y = mean(cells.reduce((sum, cell) => sum + cell.row, 0));
	return { x: x + dx, y: y + dy };
}
