// The message-key contract for scripts/import-strings.ts (FE-1).
//
// A key is the strings.json path without the locale level, joined with "_".
// Each path segment is made identifier-safe: split on runs of characters
// outside [A-Za-z0-9], lower-case the first character of the first word,
// upper-case the first character of every later word, keep the rest as is
// ("With pork" -> "withPork", "Slow-cooked" -> "slowCooked", "L" -> "l").
// Plain lists become one key per item, suffixed with the index. The top-level
// "_note" is not a message.
export const PLURAL_MESSAGE_KEYS = ['home_variation', 'home_dish'] as const;

const indexed = (prefix: string, n: number) =>
	Array.from({ length: n }, (_, i) => `${prefix}_${i}`);

export const EXPECTED_MESSAGE_KEYS: readonly string[] = [
	'home_regional',
	'home_popular',
	'home_regionsCount',
	'home_tapRegion',
	'home_seeAll',
	'home_filters',
	'home_clearAll',
	'home_showResults',
	'home_diet',
	'home_course',
	'home_effort',
	'home_season',
	'home_language',
	'home_variation',
	'home_dish',
	'home_filterLabels_vegetarian',
	'home_filterLabels_seafood',
	'home_filterLabels_withPork',
	'home_filterLabels_tapas',
	'home_filterLabels_mains',
	'home_filterLabels_desserts',
	'home_filterLabels_quick',
	'home_filterLabels_slowCooked',
	'home_filterLabels_summer',
	'home_filterLabels_winter',
	'home_filterLabels_holyWeek',
	'home_filterLabels_allYear',
	'search_placeholder',
	'search_cancel',
	'search_try',
	'search_nothing',
	'search_hint',
	...indexed('search_groups', 3),
	...indexed('search_suggestions', 5),
	'variationsPage_viewRecipe',
	'recipe_time',
	'recipe_serves',
	'recipe_ingredients',
	'recipe_method',
	'units_g',
	'units_ml',
	'units_kg',
	'units_l',
	'units_tsp',
	'units_decimal',
	'desktop_clickRegion',
	'desktop_noMatch',
	'desktop_ph',
	'desktop_try',
	'desktop_nothing',
	'desktop_hint',
	...indexed('desktop_g', 3),
	...indexed('desktop_tries', 5),
	'desktop_viewRecipe',
	'desktop_aboutTitle',
	'desktop_aboutBody'
];

// The inlang message-format shape of a plural message. Each form includes the
// number ("5 variations"), so callers never concatenate a number and a word.
export function pluralMessage(forms: Record<string, string>): unknown {
	const match = Object.fromEntries(
		Object.entries(forms).map(([category, word]) => [`countPlural=${category}`, `{count} ${word}`])
	);
	return [
		{
			declarations: ['input count', 'local countPlural = count: plural'],
			selectors: ['countPlural'],
			match
		}
	];
}

// Keys that come from src/lib/i18n/extra-strings.json (UI copy the design
// strings.json lacks). The file may grow; these must always exist.
export const EXTRA_MESSAGE_KEYS = [
	'errors_notFoundTitle',
	'errors_notFoundBody',
	'errors_serverErrorTitle',
	// FE-3: IconButton accessible names, product copy (not the dev gallery's).
	'a11y_search',
	'a11y_back',
	'a11y_close',
	'a11y_check'
] as const;

// Moved to a11y_* (FE-3 review); the dev gallery block keeps only its own copy.
export const RETIRED_MESSAGE_KEYS = [
	'devUi_search',
	'devUi_back',
	'devUi_close',
	'devUi_check'
] as const;
