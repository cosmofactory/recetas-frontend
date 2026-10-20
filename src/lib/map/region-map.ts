import type { components } from '#lib/api/schema.d.ts';
import mapGridFile from './map-grid.json';
import { labelPosition, parseGrid, type GridCell, type MapGrid } from './grid.ts';

// The bundled layout (D-FE4-1), parsed once. Which regions are drawn, in
// which order and colour, is the API's: a region only gets its cells here.

const mapGrid: MapGrid = mapGridFile;
const cellsByRegion = parseGrid(mapGrid);

const PERCENT = 100;

export const mapSize = { columns: mapGrid.columns, rows: mapGrid.rows };

// A label's centre as CSS percentages of the map box.
export type LabelPlacement = { left: string; top: string };

export type RegionShape = { cells: GridCell[]; label: LabelPlacement };

// A region as the server catalog hands it on: tileColor is null when the API
// sent anything but #RRGGBB (#lib/server/region-colour.ts).
export type MapRegionData = Omit<components['schemas']['Region'], 'tileColor'> & {
	tileColor: string | null;
};

export type ShapedRegion = MapRegionData & { shape: RegionShape };

function placement(cells: GridCell[], key: string): LabelPlacement {
	const { x, y } = labelPosition(cells, mapGrid.labelNudges?.[key]);
	return { left: `${(x / mapGrid.columns) * PERCENT}%`, top: `${(y / mapGrid.rows) * PERCENT}%` };
}

const shapes = new Map(
	[...cellsByRegion].map(([key, cells]) => [key, { cells, label: placement(cells, key) }])
);

// The regions the map can draw, in the caller's (API) order, with their shapes.
export function shapedRegions(regions: readonly MapRegionData[]): ShapedRegion[] {
	return regions.flatMap((region) => {
		const shape = shapes.get(region.key);
		return shape ? [{ ...region, shape }] : [];
	});
}
