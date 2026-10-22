import { pageTitle } from '#lib/page-title.ts';

// Stage FE-6 -> Small decisions: the Variations page is "Asadorov · {dish}",
// the Recipe page "Asadorov · {dish} · {variation}" (a variation name can be
// descriptive, e.g. "With chorizo", so the dish gives it context). Their
// descriptions are the dish's and the variation's.
export const variationsTitle = (dishName: string): string => pageTitle(dishName);

export const recipeTitle = (dishName: string, variationName: string): string =>
	pageTitle(dishName, variationName);
