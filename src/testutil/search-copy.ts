// FE-7 PR 2 fixtures shared by the search overlay's component spec and its
// Playwright spec: plain constants only (no #lib, node: or Playwright
// imports), so both runners can load them.
//
// Copy: design strings.json search.* (placeholder, cancel, try, nothing,
// hint, groups, suggestions) and extra-strings.json a11y.search (the
// dialog's and the field's accessible name, as the header button's).
// clearSearch is new FE-7 copy the design lacks (the "×" is icon-only, so it
// needs an accessible name): it belongs in extra-strings.json a11y.clearSearch.

export const SEARCH_LOCALES = ['en', 'es', 'ru'] as const;
export type SearchLocale = (typeof SEARCH_LOCALES)[number];

export type SearchCopy = {
	dialog: string;
	placeholder: string;
	cancel: string;
	clear: string;
	try: string;
	nothing: string;
	hint: string;
	groups: [dishes: string, variations: string, regions: string];
	suggestions: string[];
};

export const SEARCH_COPY: Record<SearchLocale, SearchCopy> = {
	en: {
		dialog: 'Search',
		placeholder: 'Dishes, variations, regions',
		cancel: 'Cancel',
		clear: 'Clear search',
		try: 'Try',
		nothing: 'Nothing for',
		hint: 'Try a dish, a region or an ingredient.',
		groups: ['Dishes', 'Variations', 'Regions'],
		suggestions: ['Tortilla', 'Paella', 'Galicia', 'Croquetas', 'Andalucía']
	},
	es: {
		dialog: 'Buscar',
		placeholder: 'Platos, variantes, regiones',
		cancel: 'Cancelar',
		clear: 'Borrar búsqueda',
		try: 'Prueba',
		nothing: 'Nada para',
		hint: 'Prueba con un plato, una región o un ingrediente.',
		groups: ['Platos', 'Variantes', 'Regiones'],
		suggestions: ['Tortilla', 'Paella', 'Galicia', 'Croquetas', 'Andalucía']
	},
	ru: {
		dialog: 'Поиск',
		placeholder: 'Блюда, варианты, регионы',
		cancel: 'Отмена',
		clear: 'Очистить поиск',
		try: 'Попробуйте',
		nothing: 'Ничего по запросу',
		hint: 'Попробуйте блюдо, регион или ингредиент.',
		groups: ['Блюда', 'Варианты', 'Регионы'],
		suggestions: ['Тортилья', 'Рис', 'Галисия', 'Крокеты', 'Андалусия']
	}
};

// Mobile prototype (Search.dc.html): `{t.nothing} “{query}”`, the query as
// typed, in curly double quotes in every language.
export const nothingFor = (lang: SearchLocale, query: string) =>
	`${SEARCH_COPY[lang].nothing} “${query}”`;

// Test ids inside each result row (role="option").
export const RESULT_TEST_IDS = {
	thumb: 'search-result-thumb',
	title: 'search-result-title',
	subtitle: 'search-result-subtitle',
	field: 'search-field'
} as const;
