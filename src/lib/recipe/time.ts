import { formatNumber } from '#lib/i18n/format.ts';
import type { Locale } from '#lib/i18n/locales.ts';
import { m } from '#lib/paraglide/messages.js';

const MINUTES_PER_HOUR = 60;

// Stage FE-6 -> Small decisions: content.json's shape ("25 min", "1 h 15 min",
// "3 h"), a zero part left out, then the API's already localised note.
// Intl.DurationFormat's en output ("1 hr, 15 min") doesn't match the design.
export function formatRecipeTime(locale: string, minutes: number, note: string | null): string {
	const time = durationParts(locale, minutes).join(' ');
	return note ? `${time} ${note}` : time;
}

function durationParts(locale: string, totalMinutes: number): string[] {
	const options = { locale: locale as Locale };
	const hours = Math.floor(totalMinutes / MINUTES_PER_HOUR);
	const minutes = totalMinutes % MINUTES_PER_HOUR;
	const parts: string[] = [];
	if (hours > 0) parts.push(`${formatNumber(locale, hours)} ${m.recipe_hours({}, options)}`);
	if (minutes > 0 || hours === 0) {
		parts.push(`${formatNumber(locale, minutes)} ${m.recipe_minutes({}, options)}`);
	}
	return parts;
}
