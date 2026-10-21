// FE-5 fixtures shared by the Popular tab's component specs and Playwright
// specs: plain constants only (no #lib, node: or Playwright imports), so both
// runners can load them. Copy is strings.json home.* / desktop.noMatch; the
// content is the vendored mock bundle (DATA_SOURCE=mock).

export const POPULAR_LOCALES = ['en', 'es', 'ru'] as const;
export type PopularLocale = (typeof POPULAR_LOCALES)[number];

// Test ids the Popular tab exposes (FE-5 PR 1 contract).
export const TEST_IDS = {
	filterBar: 'filter-bar',
	dishCard: 'dish-card',
	resultCount: 'result-count',
	noMatch: 'no-match',
	// FE-5 PR 2: the content components' roots.
	filterGroups: 'filter-groups',
	dishDetails: 'dish-details'
} as const;

// The Filters button: data-active="true" while any filter is on (ink fill).
export const FILTERS_ACTIVE_ATTR = 'data-active';

export const QUICK_IDS = ['vegetarian', 'quick', 'desserts', 'summer'] as const;
export type QuickId = (typeof QUICK_IDS)[number];

export type PopularCopy = {
	popular: string;
	filters: string;
	clearAll: string;
	noMatch: string;
	quick: Record<QuickId, string>;
	// home.dish plural, for the result counts the specs use.
	dishes: Record<0 | 1 | 2 | 3 | 7, string>;
};

export const POPULAR_COPY: Record<PopularLocale, PopularCopy> = {
	en: {
		popular: 'Popular',
		filters: 'Filters',
		clearAll: 'Clear all',
		noMatch: 'No dishes match these filters.',
		quick: { vegetarian: 'Vegetarian', quick: 'Quick', desserts: 'Desserts', summer: 'Summer' },
		dishes: { 0: '0 dishes', 1: '1 dish', 2: '2 dishes', 3: '3 dishes', 7: '7 dishes' }
	},
	es: {
		popular: 'Popular',
		filters: 'Filtros',
		clearAll: 'Borrar todo',
		noMatch: 'Ningún plato coincide con estos filtros.',
		quick: { vegetarian: 'Vegetariano', quick: 'Rápido', desserts: 'Postres', summer: 'Verano' },
		dishes: { 0: '0 platos', 1: '1 plato', 2: '2 platos', 3: '3 platos', 7: '7 platos' }
	},
	ru: {
		popular: 'Популярное',
		filters: 'Фильтры',
		clearAll: 'Сбросить',
		noMatch: 'Нет блюд по этим фильтрам.',
		quick: { vegetarian: 'Вегетарианское', quick: 'Быстро', desserts: 'Десерты', summer: 'Лето' },
		dishes: { 0: '0 блюд', 1: '1 блюдо', 2: '2 блюда', 3: '3 блюда', 7: '7 блюд' }
	}
};

// "Filters · N" (mobile README -> Filter bar; prototype countLabel
// `T.filters + ' · ' + active.length`).
export const filtersLabel = (lang: PopularLocale, count: number) =>
	count === 0 ? POPULAR_COPY[lang].filters : `${POPULAR_COPY[lang].filters} · ${count}`;

// The bundle's dishes in dish order (Dish.order).
export const DISH_KEYS = [
	'tortilla',
	'paella',
	'cocido',
	'gazpacho',
	'croquetas',
	'torrijas',
	'arrozleche'
] as const;

export const DISH_NAMES: Record<PopularLocale, Record<(typeof DISH_KEYS)[number], string>> = {
	en: {
		tortilla: 'Tortilla de patatas',
		paella: 'Rice dishes',
		cocido: 'Cocido & stews',
		gazpacho: 'Cold soups',
		croquetas: 'Croquetas',
		torrijas: 'Fried sweets',
		arrozleche: 'Milk puddings'
	},
	es: {
		tortilla: 'Tortilla de patatas',
		paella: 'Arroces',
		cocido: 'Cocidos y guisos',
		gazpacho: 'Sopas frías',
		croquetas: 'Croquetas',
		torrijas: 'Dulces fritos',
		arrozleche: 'Postres de leche'
	},
	ru: {
		tortilla: 'Тортилья',
		paella: 'Блюда из риса',
		cocido: 'Косидо и рагу',
		gazpacho: 'Холодные супы',
		croquetas: 'Крокеты',
		torrijas: 'Жареные сладости',
		arrozleche: 'Молочные десерты'
	}
};

// The card preview line: the first two variations in region order, as
// "Region · Variation · Region · Variation" (whitespace collapsed). Paella
// is listed val, cat, … in the bundle; region order puts Catalonia and
// Aragón first.
export const PREVIEWS: Record<
	PopularLocale,
	Partial<Record<(typeof DISH_KEYS)[number], string>>
> = {
	en: {
		tortilla: 'Galicia · Betanzos-style runny · Asturias · With chorizo',
		paella: 'Catalonia · Arròs negre · Aragón · Arroz con conejo',
		gazpacho: 'Valencia · Ajoblanco con uvas · Extremadura · Ajoblanco extremeño'
	},
	es: {
		tortilla: 'Galicia · Estilo Betanzos, jugosa · Asturias · Con chorizo',
		paella: 'Cataluña · Arròs negre · Aragón · Arroz con conejo'
	},
	ru: {
		tortilla: 'Галисия · По-бетансосски, жидкая внутри · Астурия · С чорисо',
		paella: 'Каталония · Arròs negre · Арагон · Arroz con conejo'
	}
};

// home.variation for each bundle dish's variation count.
export const VARIATION_COUNTS: Record<
	PopularLocale,
	Partial<Record<(typeof DISH_KEYS)[number], string>>
> = {
	en: { tortilla: '13 variations', paella: '7 variations', gazpacho: '5 variations' },
	es: { tortilla: '13 variantes', paella: '7 variantes' },
	ru: { tortilla: '13 вариантов', paella: '7 вариантов', torrijas: '6 вариантов' }
};

// Words the UI must never use for a variation (CLAUDE.md glossary).
export const NOT_THE_GLOSSARY = /version|recipe|recetas?\b|versi[oó]n|рецепт|верси/i;

// FE-5 PR 2 copy: strings.json home.* (the Filters sheet and the dish sheet).

export const FILTER_IDS = [
	'vegetarian',
	'seafood',
	'pork',
	'tapas',
	'mains',
	'desserts',
	'quick',
	'slow-cooked',
	'summer',
	'winter',
	'easter',
	'all-year'
] as const;
export type FilterIdCopy = (typeof FILTER_IDS)[number];

export const GROUP_KEYS = ['diet', 'course', 'effort', 'season'] as const;
export type GroupKey = (typeof GROUP_KEYS)[number];

// Mobile README -> Filters sheet: the four groups and their chips, in order.
export const GROUP_IDS: Record<GroupKey, readonly FilterIdCopy[]> = {
	diet: ['vegetarian', 'seafood', 'pork'],
	course: ['tapas', 'mains', 'desserts'],
	effort: ['quick', 'slow-cooked'],
	season: ['summer', 'winter', 'easter', 'all-year']
};

export type SheetCopy = {
	showResults: string;
	seeAll: string;
	groups: Record<GroupKey, string>;
	labels: Record<FilterIdCopy, string>;
};

export const SHEET_COPY: Record<PopularLocale, SheetCopy> = {
	en: {
		showResults: 'Show results',
		seeAll: 'See all variations',
		groups: { diet: 'Diet', course: 'Course', effort: 'Effort', season: 'Season' },
		labels: {
			vegetarian: 'Vegetarian',
			seafood: 'Seafood',
			pork: 'With pork',
			tapas: 'Tapas',
			mains: 'Mains',
			desserts: 'Desserts',
			quick: 'Quick',
			'slow-cooked': 'Slow-cooked',
			summer: 'Summer',
			winter: 'Winter',
			easter: 'Holy Week',
			'all-year': 'All year'
		}
	},
	es: {
		showResults: 'Ver resultados',
		seeAll: 'Ver todas las variantes',
		groups: { diet: 'Dieta', course: 'Tipo de plato', effort: 'Preparación', season: 'Temporada' },
		labels: {
			vegetarian: 'Vegetariano',
			seafood: 'Marisco',
			pork: 'Con cerdo',
			tapas: 'Tapas',
			mains: 'Principales',
			desserts: 'Postres',
			quick: 'Rápido',
			'slow-cooked': 'Cocción lenta',
			summer: 'Verano',
			winter: 'Invierno',
			easter: 'Semana Santa',
			'all-year': 'Todo el año'
		}
	},
	ru: {
		showResults: 'Показать',
		seeAll: 'Все варианты',
		groups: { diet: 'Питание', course: 'Тип блюда', effort: 'Готовка', season: 'Сезон' },
		labels: {
			vegetarian: 'Вегетарианское',
			seafood: 'Морепродукты',
			pork: 'Со свининой',
			tapas: 'Тапас',
			mains: 'Основные',
			desserts: 'Десерты',
			quick: 'Быстро',
			'slow-cooked': 'Долгая готовка',
			summer: 'Лето',
			winter: 'Зима',
			easter: 'Страстная неделя',
			'all-year': 'Круглый год'
		}
	}
};

// The bundle's dishes in the dish sheet: variations in region order (the
// API's order, never by count), as region keys (the same in every locale).
export const VARIATION_REGIONS = {
	tortilla: [
		'gal',
		'ast',
		'bas',
		'cat',
		'cyl',
		'mad',
		'ara',
		'val',
		'ext',
		'clm',
		'mur',
		'and',
		'bal'
	],
	// Bundle order is val, cat, mur, and, bal, ara, can; region order wins.
	paella: ['cat', 'ara', 'val', 'mur', 'and', 'bal', 'can']
} as const;

export type VariationRowCopy = { region: string; name: string; description: string };

// Tortilla's first variation row and its description, per locale.
export const TORTILLA_SHEET: Record<
	PopularLocale,
	{ name: string; description: string; count: string; first: VariationRowCopy }
> = {
	en: {
		name: 'Tortilla de patatas',
		description: 'One dish, two centuries of argument. Onion or none is only where it starts.',
		count: '13 variations',
		first: {
			region: 'Galicia',
			name: 'Betanzos-style runny',
			description: 'Barely-set centre, no onion, eaten with bread'
		}
	},
	es: {
		name: 'Tortilla de patatas',
		description: 'Un plato, dos siglos de discusión. Con o sin cebolla es solo el principio.',
		count: '13 variantes',
		first: {
			region: 'Galicia',
			name: 'Estilo Betanzos, jugosa',
			description: 'Centro apenas cuajado, sin cebolla, con pan'
		}
	},
	ru: {
		name: 'Тортилья',
		description: 'Одно блюдо — два века споров. С луком или без — это только начало.',
		count: '13 вариантов',
		first: {
			region: 'Галисия',
			name: 'По-бетансосски, жидкая внутри',
			description: 'Едва схваченная серединка, без лука, едят с хлебом'
		}
	}
};

// extra-strings.json a11y.sheetHandle: the sheet handle's name (no visible text).
export const HANDLE_LABELS: Record<PopularLocale, string> = {
	en: 'Expand or collapse',
	es: 'Expandir o contraer',
	ru: 'Развернуть или свернуть'
};
