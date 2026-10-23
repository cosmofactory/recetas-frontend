import bundle from '../lib/server/mock/content.bundle.json' with { type: 'json' };
import type { Locale } from './e2e';

// The 14 regions as the map shows them, per locale, from the vendored mock
// bundle (DATA_SOURCE=mock; demo is seeded from the same design content).

export type MapRegionCopy = { key: string; name: string; mapLabel: string };

export const REGION_COUNT = 14;

export function mapRegions(lang: Locale): MapRegionCopy[] {
	return bundle.regions.map((region) => ({
		key: region.key,
		name: region.name[lang],
		mapLabel: region.mapLabel[lang]
	}));
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// FE-4: a region link is named by its mapLabel, then its name when it differs
// ("Euskadi" + "Basque Country", WCAG 2.5.3).
export function regionLinkName(region: MapRegionCopy): RegExp {
	const label = escapeRegExp(region.mapLabel);
	if (region.mapLabel === region.name) return new RegExp(`^${label}$`);
	return new RegExp(`^${label}\\s.*${escapeRegExp(region.name)}`);
}
