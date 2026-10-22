import { m } from '#lib/paraglide/messages.js';
import type { Locale } from './locales.ts';

// The middle dot between parts of one line ("Asadorov · Popular", "Filters · 2",
// "Region · Variation"); the prototypes use it everywhere.
export const DOT_SEPARATOR = ' · ';

// Quantities show at most one decimal unless the caller asks otherwise.
const DEFAULT_NUMBER_FORMAT: Intl.NumberFormatOptions = { maximumFractionDigits: 1 };

// Recipe units (content.json) and their strings.json -> units labels.
const UNIT_MESSAGES = {
	g: m.units_g,
	ml: m.units_ml,
	kg: m.units_kg,
	L: m.units_l,
	tsp: m.units_tsp
} as const;

export type Unit = keyof typeof UNIT_MESSAGES;

// Decimal comma in es/ru ("1,2"), grouping per locale.
export function formatNumber(
	locale: Locale | string,
	n: number,
	options: Intl.NumberFormatOptions = DEFAULT_NUMBER_FORMAT
): string {
	return new Intl.NumberFormat(locale, options).format(n);
}

export function unitLabel(locale: Locale | string, unit: Unit | string): string {
	if (!Object.hasOwn(UNIT_MESSAGES, unit)) throw new Error(`unitLabel: unknown unit ${unit}`);
	return UNIT_MESSAGES[unit as Unit]({}, { locale: locale as Locale });
}
