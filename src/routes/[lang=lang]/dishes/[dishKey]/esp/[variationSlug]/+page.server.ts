import { catalog } from '#lib/server/catalog.ts';
import { orHttpError } from '#lib/server/load-errors.ts';
import type { PageServerLoad } from './$types';

// A Spanish (Spain-wide) variation's Recipe page (BE-9): the static `esp`
// segment takes precedence over [regionKey], and the slug finds the recipe.
export const load: PageServerLoad = async (event) => {
	const { lang, dishKey, variationSlug } = event.params;
	const pending = catalog().getSpainWideRecipe(lang, { dishKey, variationSlug });
	return { recipe: await orHttpError(pending, event) };
};
