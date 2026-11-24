// The reserved region key of a Spanish (Spain-wide) variation (BE-9 D-ESP-3):
// never a region, so never on the map or in a region's list.
export const SPAIN_WIDE_KEY = 'esp';

export const isSpainWide = (variation: { regionKey: string }): boolean =>
	variation.regionKey === SPAIN_WIDE_KEY;
