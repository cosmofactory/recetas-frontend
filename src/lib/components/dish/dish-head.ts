import { pageTitle } from '#lib/page-title.ts';

// Stage FE-6 -> Small decisions: the Variations page is "Asadorov · {dish}",
// the Recipe page "Asadorov · {recipe title}", the variationTitle that names
// the dish (FE-9 D-FE9-6). Their descriptions are the dish's and the
// variation's.
export const variationsTitle = (dishName: string): string => pageTitle(dishName);

export const recipeTitle = (title: string): string => pageTitle(title);
