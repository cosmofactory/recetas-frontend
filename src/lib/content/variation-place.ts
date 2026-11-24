import type { Locale } from '#lib/i18n/locales.ts';
import { m } from '#lib/paraglide/messages.js';
import { isSpainWide } from './spain-wide.ts';

export type PlacedVariation = { regionKey: string; regionName: string | null };

// The region-slot rule (both READMEs -> "Spanish (Spain-wide) variations"):
// wherever a region name is shown, a Spanish variation shows the Spanish term.
// A regional variation always has a name; its key is only a fallback.
export function variationPlace(variation: PlacedVariation, locale: Locale): string {
	if (isSpainWide(variation)) return m.spainWide_label({}, { locale });
	return variation.regionName ?? variation.regionKey;
}
