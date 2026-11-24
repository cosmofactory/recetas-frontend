// FE-11 fixtures shared by the unit, SSR and Playwright specs: plain
// constants only (no #lib, node: or Playwright imports), so every runner can
// load them. Sources: both READMEs -> "Spanish (Spain-wide) variations
// (2026-11-23)", the stage file specs/stages/backend/BE-9-spain-wide.md
// (D-ESP-1..7, FE-11) and the design samples in content.json, served by the
// vendored mock bundle (DATA_SOURCE=mock).

export const SPAIN_WIDE_LOCALES = ['en', 'es', 'ru'] as const;
export type SpainWideLocale = (typeof SPAIN_WIDE_LOCALES)[number];

// The reserved region key of a Spanish variation (D-ESP-3).
export const SPAIN_WIDE_KEY = 'esp';

// strings.json -> spainWide.label: the term in every region slot.
export const SPAIN_WIDE_LABEL: Record<SpainWideLocale, string> = {
	en: 'Spanish',
	es: 'España',
	ru: 'Испания'
};

// strings.json -> home.filterLabels.Basics (ru avoids "Основы").
export const BASICS_LABEL: Record<SpainWideLocale, string> = {
	en: 'Basics',
	es: 'Básicos',
	ru: 'Базовые'
};

// The filter id of the fourth Course chip, ASCII like the others (D-FE5-1).
export const BASICS_FILTER_ID = 'basics';

export type SpainWideVariation = { slug: string; name: string; description: string };

export type SpainWideDish = {
	key: string;
	name: Record<SpainWideLocale, string>;
	variations: readonly SpainWideVariation[];
};

// Allioli: course basics, two Spanish variations and no regional one.
export const ALLIOLI: SpainWideDish = {
	key: 'allioli',
	name: { en: 'Allioli', es: 'Allioli', ru: 'Альиоли' },
	variations: [
		{
			slug: 'allioli-de-morter',
			name: 'Allioli de morter',
			description: 'Garlic and oil only, pounded by hand'
		},
		{
			slug: 'allioli-de-codony',
			name: 'Allioli de codony',
			description: 'Baked quince folded in, for game and rice'
		}
	]
};

// Arroz blanco con tomate: course mains, exactly one variation, a Spanish
// one, so it has no Variations page.
export const ARROZ_BLANCO: SpainWideDish = {
	key: 'arrozblanco',
	name: {
		en: 'Arroz blanco con tomate',
		es: 'Arroz blanco con tomate',
		ru: 'Арроз бланко с томатом'
	},
	variations: [
		{
			slug: 'arroz-blanco-con-tomate',
			name: 'Arroz blanco con tomate',
			description: 'Garlic-scented rice, tomate frito on top'
		}
	]
};

// The en text of the Arroz blanco recipe's first step (a marker that the
// recipe, not a Variations page, is open).
export const ARROZ_BLANCO_FIRST_STEP =
	'Brown the whole garlic cloves in the oil, add the rice and stir for a minute.';

// /:lang/dishes/:dishKey/esp/:variationSlug, the new Recipe URL.
export const spainWideRecipePath = (lang: string, dishKey: string, slug: string) =>
	`/${lang}/dishes/${dishKey}/esp/${slug}`;

export const ARROZ_BLANCO_RECIPE_PATH = (lang: string) =>
	spainWideRecipePath(lang, ARROZ_BLANCO.key, ARROZ_BLANCO.variations[0].slug);

// The vendored bundle's dishes in dish order (none is scored, so bundle order).
export const BUNDLE_DISH_KEYS = [
	'tortilla',
	'paella',
	'cocido',
	'gazpacho',
	'croquetas',
	'torrijas',
	'arrozleche',
	'allioli',
	'arrozblanco'
] as const;
