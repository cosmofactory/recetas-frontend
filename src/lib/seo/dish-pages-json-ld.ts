import type { components } from '#lib/api/schema.d.ts';
import { localizedHref, recipeHref, variationsHref } from '#lib/i18n/localized-href.ts';
import type { Locale } from '#lib/i18n/locales.ts';
import { SITE_NAME } from '#lib/page-title.ts';
import type { JsonLdNode } from './json-ld.ts';
import { breadcrumbJsonLd, itemListJsonLd, type LinkedPage } from './list-json-ld.ts';
import { recipeJsonLd } from './recipe-json-ld.ts';

type Dish = components['schemas']['Dish'];
type Recipe = components['schemas']['Recipe'];

// Where a page is: PUBLIC_ORIGIN, its locale and its canonical URL.
export type PageLocation = { origin: string; lang: Locale; url: string };

const HOME_PATH = '/';

// The brand is the home crumb's name, untranslated like the site name.
const homeCrumb = ({ origin, lang }: PageLocation): LinkedPage => ({
	name: SITE_NAME,
	url: `${origin}${localizedHref(HOME_PATH, lang)}`
});

// Variations page: Home → dish, and its variations' Recipe pages in the API's
// region order (all equal, none first by merit).
export function variationsPageJsonLd(dish: Dish, location: PageLocation): JsonLdNode[] {
	const { origin, lang, url } = location;
	const recipes = dish.variations.map((variation) => ({
		name: variation.name,
		url: `${origin}${recipeHref(dish.key, variation.regionKey, lang)}`
	}));
	return [
		breadcrumbJsonLd([homeCrumb(location), { name: dish.name, url }]),
		itemListJsonLd(recipes)
	];
}

export type RecipePageInput = {
	recipe: Recipe;
	// The [lang=lang] layout's list, for the dish's course.
	dishes: readonly Dish[];
	mediaBaseUrl: string | undefined;
};

// Recipe page: the Recipe, and Home → dish → variation.
export function recipePageJsonLd(input: RecipePageInput, location: PageLocation): JsonLdNode[] {
	const { recipe, dishes, mediaBaseUrl } = input;
	const { origin, lang, url } = location;
	const course = dishes.find((dish) => dish.key === recipe.dishKey)?.course;
	const dishCrumb = {
		name: recipe.dishName,
		url: `${origin}${variationsHref(recipe.dishKey, lang)}`
	};
	return [
		recipeJsonLd({ recipe, course, lang, url, origin, mediaBaseUrl }),
		breadcrumbJsonLd([homeCrumb(location), dishCrumb, { name: recipe.name, url }])
	];
}
