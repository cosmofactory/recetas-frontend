import type { components } from '#lib/api/schema.d.ts';
import type { Lang } from '../catalog-source.ts';

// The backend's import bundle (recetas-backend/testdata/content.design.json,
// vendored as content.bundle.json): every human-readable field per locale.
// Typed loosely enough that the JSON import fits without a cast; enums are
// checked when the bundle is mapped (bundle-mapping.ts).

type Schemas = components['schemas'];
export type Localized = Record<Lang, string>;

export type BundlePhotos = {
	thumb?: string | null;
	card?: string | null;
	hero?: string | null;
} | null;

export type BundleRegion = {
	key: string;
	tileColor: string;
	name: Localized;
	mapLabel: Localized;
	description: Localized;
	regionalDishes: string[];
};

export type BundleVariation = {
	regionKey: string;
	recipeKey: string;
	name: Localized;
	description: Localized;
	photos: BundlePhotos;
};

export type BundleDish = {
	key: string;
	name: Localized;
	description: Localized;
	flags: Schemas['Flags'];
	course: string;
	season: string;
	photos: BundlePhotos;
	variations: BundleVariation[];
};

export type BundleRecipe = {
	recipeKey: string;
	timeMinutes: number;
	timeNote: Localized | null;
	baseServings: number;
	ingredients: { quantity: number; unit: string | null; name: Localized }[];
	steps: Localized[];
};

export type ContentBundle = {
	regions: BundleRegion[];
	dishes: BundleDish[];
	recipes: BundleRecipe[];
};
