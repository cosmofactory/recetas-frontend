import type { CatalogRegion } from '#lib/api/catalog-region.ts';
import mapGridFile from './map-grid.json';
import { labelCells, labelPosition, parseGrid, type GridCell, type MapGrid } from './grid.ts';

// The bundled layout (D-FE4-1), parsed once. Which regions are drawn, in
// which order and colour, is the API's: a region only gets its cells here.

const mapGrid: MapGrid = mapGridFile;
const cellsByRegion = parseGrid(mapGrid);
const labelCellsByRegion = labelCells(mapGrid);

const PERCENT = 100;

export const mapSize = { columns: mapGrid.columns, rows: mapGrid.rows };

// A label's centre as CSS percentages of the map box.
export type LabelPlacement = { left: string; top: string };

// A run of a region's cells in one row, as CSS grid lines (end exclusive).
export type RowSpan = { row: number; columnStart: number; columnEnd: number };

// bottomEdge: a one-row region's cells when only sea lies below them, if so.
export type RegionShape = { cells: GridCell[]; label: LabelPlacement; bottomEdge: RowSpan | null };

export type MapRegionData = CatalogRegion;

export type ShapedRegion = MapRegionData & { shape: RegionShape };

function placement(key: string): LabelPlacement {
	const { x, y } = labelPosition(labelCellsByRegion.get(key) ?? [], mapGrid.labelNudges?.[key]);
	return { left: `${(x / mapGrid.columns) * PERCENT}%`, top: `${(y / mapGrid.rows) * PERCENT}%` };
}

// Grid rows are 1-based, so the 0-based line index of the row below is `row`.
function onlySeaBelow(cell: GridCell): boolean {
	return mapGrid.grid.slice(cell.row).every((line) => line[cell.col - 1] === mapGrid.emptyCell);
}

function bottomEdge(cells: GridCell[]): RowSpan | null {
	const [first] = cells;
	if (first === undefined) return null;
	if (cells.some((cell) => cell.row !== first.row || !onlySeaBelow(cell))) return null;
	const columns = cells.map((cell) => cell.col);
	return {
		row: first.row,
		columnStart: Math.min(...columns),
		columnEnd: Math.max(...columns) + 1
	};
}

const shapes = new Map(
	[...cellsByRegion].map(([key, cells]): [string, RegionShape] => [
		key,
		{ cells, label: placement(key), bottomEdge: bottomEdge(cells) }
	])
);

// The regions the map can draw, in the caller's (API) order, with their shapes.
export function shapedRegions(regions: readonly MapRegionData[]): ShapedRegion[] {
	return regions.flatMap((region) => {
		const shape = shapes.get(region.key);
		return shape ? [{ ...region, shape }] : [];
	});
}
