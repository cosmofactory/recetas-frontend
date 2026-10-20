import { log } from './log.ts';

// A region's tileColor ends up in the map cells' style attribute, so it is
// checked once here, where API and bundle regions enter the app: only
// #RRGGBB passes. Anything else is logged and becomes null, which the map
// draws as the placeholder.

const TILE_COLOUR = /^#[0-9A-Fa-f]{6}$/;

type Coloured = { key: string; tileColor: string | null };

export type WithValidColour<R extends Coloured> = Omit<R, 'tileColor'> & {
	tileColor: string | null;
};

export function withValidTileColor<R extends Coloured>(region: R): WithValidColour<R> {
	if (region.tileColor === null || TILE_COLOUR.test(region.tileColor)) return region;
	log.error('invalid region tileColor', {
		region_key: region.key,
		tile_color: region.tileColor
	});
	return { ...region, tileColor: null };
}
