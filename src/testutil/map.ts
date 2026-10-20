import type { components } from '#lib/api/schema.d.ts';
import type { Region as CatalogRegion } from '#lib/server/catalog-source.ts';
import { localizedHref } from '#lib/i18n/localized-href.ts';
import { buildView } from '#lib/server/mock/bundle-mapping.ts';
import bundle from '#lib/server/mock/content.bundle.json';

// FE-4 map fixtures: the contract of src/lib/map/grid.ts (D-FE4-1) and the
// regions exactly as GET /v1/regions returns them, from the vendored mock
// bundle (DATA_SOURCE=mock maps it the same way). Shared by the Node and the
// browser specs, so no node: imports here.

// A region as the server catalog hands it on: tileColor is null when the API
// sent anything but #RRGGBB (validated once at the server boundary).
export type Region = CatalogRegion;
export type MapRegion = CatalogRegion;
export type Lang = components['schemas']['Locale'];

// The vendored bundle's colours are all valid, so a fixture region's
// tileColor is a #RRGGBB string; this says so rather than asserting non-null.
export function tileColorOf(region: Region): string {
	const colour = region.tileColor;
	if (colour === null || !HEX_COLOUR.test(colour)) {
		throw new Error(`fixture region ${region.key} has tileColor ${colour}, want #RRGGBB`);
	}
	return colour;
}

const HEX_COLOUR = /^#[0-9A-Fa-f]{6}$/;

// 1-based CSS grid lines (grid-row-start / grid-column-start).
export type GridCell = { row: number; col: number };

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

export type ParseGrid = (mapGrid: MapGrid) => Map<string, GridCell[]>;

// Cell units from the map's top-left corner: (0, 0) .. (columns, rows).
export type LabelPoint = { x: number; y: number };
export type LabelPosition = (cells: GridCell[], nudge?: readonly number[]) => LabelPoint;

export const MAP_COLUMNS = 14;
export const MAP_ROWS = 11;

export function regionsIn(lang: Lang): Region[] {
	return buildView(bundle, lang).regions;
}

export function regionHref(lang: Lang): (key: string) => string {
	return (key) => localizedHref(`/regions/${key}`, lang);
}
