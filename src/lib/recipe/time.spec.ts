import { describe, expect, it } from 'vitest';
import { loadExport } from '../../testutil/load-export';

// FE-6 PR 3: the Recipe info strip's time (stage FE-6 -> Small decisions).
// The API gives whole minutes (D-BE3-1) and an optional, already localised
// note. The value follows content.json's shape: "25 min", "1 h 15 min",
// "3 h"; a zero part is left out; the note follows after one space
// ("3 h + soaking"). Unit labels are extra-strings.json messages (en/es
// "h"/"min", ru "ч"/"мин"); Intl.DurationFormat is not used.
//
// Contract pinned here: src/lib/recipe/time.ts exports
// formatRecipeTime(locale, minutes, note: string | null): string.

type FormatRecipeTime = (locale: string, minutes: number, note: string | null) => string;

const MODULE = 'src/lib/recipe/time.ts';

const loadFormatter = () => loadExport<FormatRecipeTime>(MODULE, 'formatRecipeTime');

const WITHOUT_NOTE: [string, number, string][] = [
	['en', 25, '25 min'],
	['en', 75, '1 h 15 min'],
	['en', 180, '3 h'],
	['en', 60, '1 h'],
	['en', 5, '5 min'],
	['es', 25, '25 min'],
	['es', 75, '1 h 15 min'],
	['es', 180, '3 h'],
	['es', 60, '1 h'],
	['es', 5, '5 min'],
	['ru', 25, '25 мин'],
	['ru', 75, '1 ч 15 мин'],
	['ru', 180, '3 ч'],
	['ru', 60, '1 ч'],
	['ru', 5, '5 мин'],
	// More edges of the same rule.
	['en', 1, '1 min'],
	['en', 59, '59 min'],
	['en', 61, '1 h 1 min'],
	['en', 125, '2 h 5 min'],
	['ru', 150, '2 ч 30 мин']
];

const WITH_NOTE: [string, number, string, string][] = [
	['en', 180, '+ soaking', '3 h + soaking'],
	['es', 180, '+ remojo', '3 h + remojo'],
	['ru', 180, '+ замачивание', '3 ч + замачивание'],
	['en', 75, '+ resting', '1 h 15 min + resting'],
	['es', 25, '+ reposo', '25 min + reposo'],
	['ru', 5, '+ настаивание', '5 мин + настаивание']
];

describe('formatRecipeTime without a note', () => {
	for (const [locale, minutes, want] of WITHOUT_NOTE) {
		it(`${locale}: ${minutes} minutes is "${want}"`, async () => {
			const got = (await loadFormatter())(locale, minutes, null);
			expect(got, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`).toBe(want);
		});
	}
});

describe('formatRecipeTime with a note', () => {
	for (const [locale, minutes, note, want] of WITH_NOTE) {
		it(`${locale}: ${minutes} minutes + "${note}" is "${want}"`, async () => {
			const got = (await loadFormatter())(locale, minutes, note);
			expect(got, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`).toBe(want);
		});
	}

	it('an empty note adds nothing (no trailing space)', async () => {
		const got = (await loadFormatter())('en', 25, '');
		expect(got, `got ${JSON.stringify(got)}, want "25 min"`).toBe('25 min');
	});
});
