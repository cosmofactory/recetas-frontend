import type { components } from '#lib/api/schema.d.ts';
import type { Locale } from '#lib/i18n/locales.ts';
import { filterLabel } from '#lib/popular/filter-labels.ts';
import { ingredientQuantity } from '#lib/recipe/servings.ts';
import { isoDuration } from './iso-duration.ts';
import { SCHEMA_ORG_CONTEXT, type JsonLdNode } from './json-ld.ts';
import { heroImageUrls } from './og-image.ts';

type Recipe = components['schemas']['Recipe'];
type Course = components['schemas']['Course'];

// A classification value aggregated across pages, not copy: the same in
// every locale (stage FE-8, Small decisions).
export const RECIPE_CUISINE = 'Spanish';

export type RecipeJsonLdInput = {
	recipe: Recipe;
	course: Course | undefined;
	lang: Locale;
	// The page's canonical URL.
	url: string;
	origin: string;
	mediaBaseUrl: string | undefined;
};

// schema.org Recipe for the Recipe page, in the page's locale. The time note
// is free text and stays out; there is no author or rating (no accounts).
export function recipeJsonLd({
	recipe,
	course,
	lang,
	url,
	...media
}: RecipeJsonLdInput): JsonLdNode {
	return {
		'@context': SCHEMA_ORG_CONTEXT,
		'@type': 'Recipe',
		name: recipe.name,
		description: recipe.description,
		image: heroImageUrls({ ...media, heroPrefix: recipe.photos.hero }),
		recipeIngredient: ingredientLines(recipe, lang),
		recipeInstructions: howToSteps(recipe.steps),
		totalTime: isoDuration(recipe.timeMinutes),
		recipeYield: String(recipe.baseServings),
		recipeCuisine: RECIPE_CUISINE,
		...(course && { recipeCategory: filterLabel(course, lang) }),
		inLanguage: lang,
		url
	};
}

// "<quantity> <name>" at the base servings, with the page's own formatter.
function ingredientLines({ ingredients, baseServings }: Recipe, lang: Locale): string[] {
	return ingredients.map(
		(ingredient) =>
			`${ingredientQuantity(lang, ingredient, baseServings, baseServings)} ${ingredient.name}`
	);
}

const howToSteps = (steps: readonly string[]): JsonLdNode[] =>
	steps.map((text, i) => ({ '@type': 'HowToStep', position: i + 1, text }));
