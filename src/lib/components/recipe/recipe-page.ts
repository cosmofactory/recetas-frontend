import type { CatalogRegion } from '#lib/api/catalog-region.ts';
import type { components } from '#lib/api/schema.d.ts';

type Schemas = components['schemas'];

// What a Recipe route hands RecipePage: its loader's recipe, the root
// layout's origin and the [lang=lang] layout's lists.
export type RecipePageData = {
	recipe: Schemas['Recipe'];
	origin: string;
	mediaBaseUrl: string | undefined;
	regions: CatalogRegion[];
	dishes: Schemas['Dish'][];
};
