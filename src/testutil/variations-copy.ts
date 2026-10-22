// FE-6 PR 2 fixtures shared by the Variations page's SSR spec and Playwright
// specs: plain constants only (no #lib, node: or Playwright imports), so both
// runners can load them. Copy is strings.json variationsPage.* / home.variation
// and extra-strings.json a11y.back / errors.*; content is the vendored mock
// bundle (DATA_SOURCE=mock).

export const VARIATIONS_LOCALES = ['en', 'es', 'ru'] as const;
export type VariationsLocale = (typeof VARIATIONS_LOCALES)[number];

// Test id on each variation card, the <a> that is the whole card (FE-6 PR 2
// contract, like FE-5's dish-card).
export const VARIATION_CARD_TEST_ID = 'variation-card';

// "Asadorov · {dish}" (Variations) / "Asadorov · {dish} · {variation}" (Recipe).
export const SITE_NAME = 'Asadorov';
export const TITLE_SEPARATOR = ' · ';
export const pageTitle = (...parts: string[]) => [SITE_NAME, ...parts].join(TITLE_SEPARATOR);

export type PageCopy = {
	viewRecipe: string;
	back: string;
	notFoundTitle: string;
};

export const PAGE_COPY: Record<VariationsLocale, PageCopy> = {
	en: { viewRecipe: 'View recipe →', back: 'Back', notFoundTitle: 'Page not found' },
	es: { viewRecipe: 'Ver receta →', back: 'Atrás', notFoundTitle: 'Página no encontrada' },
	ru: { viewRecipe: 'Рецепт →', back: 'Назад', notFoundTitle: 'Страница не найдена' }
};

// home.variation for a count, per locale (CLDR: en/es one/other, ru one/few/many).
export const VARIATION_PLURALS: { lang: VariationsLocale; count: number; want: string }[] = [
	{ lang: 'en', count: 1, want: '1 variation' },
	{ lang: 'en', count: 2, want: '2 variations' },
	{ lang: 'en', count: 13, want: '13 variations' },
	{ lang: 'es', count: 1, want: '1 variante' },
	{ lang: 'es', count: 5, want: '5 variantes' },
	{ lang: 'es', count: 13, want: '13 variantes' },
	{ lang: 'ru', count: 1, want: '1 вариант' },
	{ lang: 'ru', count: 2, want: '2 варианта' },
	{ lang: 'ru', count: 4, want: '4 варианта' },
	{ lang: 'ru', count: 5, want: '5 вариантов' },
	{ lang: 'ru', count: 11, want: '11 вариантов' },
	{ lang: 'ru', count: 13, want: '13 вариантов' }
];

export type CardCopy = { regionKey: string; region: string; name: string; description: string };

export type DishPageCopy = {
	name: string;
	description: string;
	count: string;
	// The first two cards, in region order.
	cards: [CardCopy, CardCopy];
};

export const TORTILLA_PAGE: Record<VariationsLocale, DishPageCopy> = {
	en: {
		name: 'Tortilla de patatas',
		description: 'One dish, two centuries of argument. Onion or none is only where it starts.',
		count: '13 variations',
		cards: [
			{
				regionKey: 'gal',
				region: 'Galicia',
				name: 'Betanzos-style runny',
				description: 'Barely-set centre, no onion, eaten with bread'
			},
			{
				regionKey: 'ast',
				region: 'Asturias',
				name: 'With chorizo',
				description: 'Chorizo fat colours the potato'
			}
		]
	},
	es: {
		name: 'Tortilla de patatas',
		description: 'Un plato, dos siglos de discusión. Con o sin cebolla es solo el principio.',
		count: '13 variantes',
		cards: [
			{
				regionKey: 'gal',
				region: 'Galicia',
				name: 'Estilo Betanzos, jugosa',
				description: 'Centro apenas cuajado, sin cebolla, con pan'
			},
			{
				regionKey: 'ast',
				region: 'Asturias',
				name: 'Con chorizo',
				description: 'La grasa del chorizo tiñe la patata'
			}
		]
	},
	ru: {
		name: 'Тортилья',
		description: 'Одно блюдо — два века споров. С луком или без — это только начало.',
		count: '13 вариантов',
		cards: [
			{
				regionKey: 'gal',
				region: 'Галисия',
				name: 'По-бетансосски, жидкая внутри',
				description: 'Едва схваченная серединка, без лука, едят с хлебом'
			},
			{
				regionKey: 'ast',
				region: 'Астурия',
				name: 'С чорисо',
				description: 'Жир чорисо окрашивает картофель'
			}
		]
	}
};

// The direct-entry fallback of the back button (stage FE-6 -> Small decisions).
export const backFallback = (lang: string, dishKey: string) =>
	`/${lang}/?tab=popular&dish=${dishKey}`;

export const recipePath = (lang: string, dishKey: string, regionKey: string) =>
	`/${lang}/dishes/${dishKey}/${regionKey}`;

// Mobile README -> Screen 2: the bar's title and hairline appear past 230px.
export const VARIATIONS_THRESHOLD_PX = 230;
