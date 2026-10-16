import type { Photos, Recipe, Region, RegionDetail, Dish } from '#lib/server/catalog-source.ts';

// The FE-2 server data layer types (re-exported from the production
// interface, which is typed from the vendored OpenAPI contract), plus small
// API bodies taken from the design bundle.

export type {
	CatalogSource,
	Dish,
	Lang,
	Photos,
	Recipe,
	Region,
	RegionDetail,
	VariationRef
} from '#lib/server/catalog-source.ts';

export type ErrorClass = new (message?: string) => Error;

// How the API serves a missing photo: every role null, never `photos: null`.
export const NO_PHOTOS: Photos = { thumb: null, card: null, hero: null };

export const galicia: Region = {
	key: 'gal',
	order: 1,
	name: 'Galicia',
	nameEs: 'Galicia',
	mapLabel: 'Galicia',
	tileColor: '#9A9A5E',
	description: 'Atlantic seafood, pilgrim fare and Spain’s best-loved octopus.',
	regionalDishes: ['Pulpo á feira', 'Empanada gallega', 'Lacón con grelos']
};

export const galiciaDetail: RegionDetail = {
	...galicia,
	variations: [
		{
			dishKey: 'tortilla',
			dishName: 'Tortilla de patatas',
			dishNameEs: 'Tortilla de patatas',
			regionKey: 'gal',
			recipeKey: 'tortilla-gal',
			name: 'Betanzos-style runny',
			nameEs: 'Estilo Betanzos, jugosa',
			description: 'Barely-set centre, no onion, eaten with bread',
			photos: NO_PHOTOS
		}
	]
};

export const tortilla: Dish = {
	key: 'tortilla',
	order: 1,
	name: 'Tortilla de patatas',
	nameEs: 'Tortilla de patatas',
	description: 'One dish, two centuries of argument. Onion or none is only where it starts.',
	flags: { vegetarian: true, seafood: false, pork: false, quick: true, slowCooked: false },
	course: 'tapas',
	season: 'all',
	photos: NO_PHOTOS,
	variations: [
		{
			regionKey: 'gal',
			regionName: 'Galicia',
			recipeKey: 'tortilla-gal',
			name: 'Betanzos-style runny',
			nameEs: 'Estilo Betanzos, jugosa',
			description: 'Barely-set centre, no onion, eaten with bread',
			photos: NO_PHOTOS
		}
	]
};

export const tortillaGalRecipe: Recipe = {
	dishKey: 'tortilla',
	dishName: 'Tortilla de patatas',
	regionKey: 'gal',
	regionName: 'Galicia',
	recipeKey: 'tortilla-gal',
	name: 'Betanzos-style runny',
	nameEs: 'Estilo Betanzos, jugosa',
	description: 'Barely-set centre, no onion, eaten with bread',
	timeMinutes: 25,
	timeNote: null,
	baseServings: 2,
	ingredients: [{ quantity: 4, unit: null, name: 'Eggs' }],
	steps: ['Peel the potatoes and slice them very thin.'],
	photos: NO_PHOTOS
};
