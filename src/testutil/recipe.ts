import type { Recipe } from '#lib/server/catalog-source.ts';
import { buildView, recipePath } from '#lib/server/mock/bundle-mapping.ts';
import bundle from '#lib/server/mock/content.bundle.json';
import { formatQuantity, scaleQuantity } from '#lib/recipe/quantity.ts';
import type { RecipeLocale } from './recipe-copy';

// FE-6 PR 3 fixtures: a recipe exactly as the loader hands it on (from the
// vendored mock bundle, DATA_SOURCE=mock), and the quantities the page must
// show for it. The rules themselves are pinned in quantity.spec.ts; these
// derive the expected text from them, so the page is checked against the one
// implementation (CLAUDE.md: one place for each rule).

export type { Recipe };

export function recipeIn(lang: RecipeLocale, dishKey: string, regionKey: string): Recipe {
	const recipe = buildView(bundle, lang).recipes.get(recipePath(dishKey, regionKey));
	if (!recipe) throw new Error(`fixture has no recipe ${dishKey}/${regionKey}`);
	return recipe;
}

export type ExpectedIngredient = { name: string; quantity: string };

// Every ingredient's name and its quantity at `servings`.
export function expectedIngredients(
	lang: RecipeLocale,
	recipe: Recipe,
	servings: number
): ExpectedIngredient[] {
	return recipe.ingredients.map((i) => ({
		name: i.name,
		quantity: formatQuantity(lang, scaleQuantity(i.quantity, recipe.baseServings, servings), i.unit)
	}));
}
