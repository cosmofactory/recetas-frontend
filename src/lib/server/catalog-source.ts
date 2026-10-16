import type { components } from '#lib/api/schema.d.ts';

// The server data layer (FE-2): every loader reads the catalog through this
// interface, backed by the Go API (api-source.ts) or the vendored bundle
// (mock/mock-source.ts). Types come from the vendored OpenAPI contract.

type Schemas = components['schemas'];
export type Lang = Schemas['Locale'];
export type Region = Schemas['Region'];
export type RegionDetail = Schemas['RegionDetail'];
export type Dish = Schemas['Dish'];
export type Recipe = Schemas['Recipe'];
export type Photos = Schemas['Photos'];

// A variation is one dish in one region; its recipe is addressed the same way.
export type VariationRef = { dishKey: string; regionKey: string };

// Rejects with NotFoundError for an unknown key and UnavailableError when the
// backend can't answer (api-errors.ts).
export interface CatalogSource {
	listRegions(lang: Lang): Promise<Region[]>;
	listDishes(lang: Lang): Promise<Dish[]>;
	getRegion(lang: Lang, regionKey: string): Promise<RegionDetail>;
	getDish(lang: Lang, dishKey: string): Promise<Dish>;
	getRecipe(lang: Lang, ref: VariationRef): Promise<Recipe>;
}
