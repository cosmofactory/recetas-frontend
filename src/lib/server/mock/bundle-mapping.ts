import type { Dish, Lang, Photos, Recipe, Region, RegionDetail } from '../catalog-source.ts';
import type {
	BundleDish,
	BundlePhotos,
	BundleRecipe,
	BundleRegion,
	BundleVariation,
	ContentBundle
} from './bundle.ts';
import { parseCourse, parseSeason, parseUnit } from './enums.ts';
import { withValidTileColor } from '../region-colour.ts';

// Maps the import bundle into the API's response bodies for one locale, the
// way the backend does after `make seed`: order is bundle order (1-based),
// variations follow region order, Spanish text rides along as *Es, and a
// missing photo is a set of null roles.

const SPANISH: Lang = 'es';

export type CatalogView = {
	regions: Region[];
	dishes: Dish[];
	dishesByKey: Map<string, Dish>;
	regionDetails: Map<string, RegionDetail>;
	// Keyed by recipePath(dishKey, regionKey).
	recipes: Map<string, Recipe>;
};

type Context = {
	bundle: ContentBundle;
	lang: Lang;
	regions: Map<string, BundleRegion>;
	regionOrder: Map<string, number>;
	recipes: Map<string, BundleRecipe>;
};

export function recipePath(dishKey: string, regionKey: string): string {
	return `${dishKey}/${regionKey}`;
}

export function buildView(bundle: ContentBundle, lang: Lang): CatalogView {
	const ctx = context(bundle, lang);
	const regions = bundle.regions.map((r, i) => toRegion(r, i, lang));
	const dishes = bundle.dishes.map((d, i) => toDish(d, i, ctx));
	return {
		regions,
		dishes,
		dishesByKey: new Map(dishes.map((d) => [d.key, d])),
		regionDetails: new Map(regions.map((r) => [r.key, toRegionDetail(r, ctx)])),
		recipes: new Map(bundle.dishes.flatMap((d) => dishRecipes(d, ctx)))
	};
}

function context(bundle: ContentBundle, lang: Lang): Context {
	return {
		bundle,
		lang,
		regions: new Map(bundle.regions.map((r) => [r.key, r])),
		regionOrder: new Map(bundle.regions.map((r, i) => [r.key, i + 1])),
		recipes: new Map(bundle.recipes.map((r) => [r.recipeKey, r]))
	};
}

function toPhotos(photos: BundlePhotos): Photos {
	return { thumb: photos?.thumb ?? null, card: photos?.card ?? null, hero: photos?.hero ?? null };
}

function lookup<T>(map: Map<string, T>, key: string, what: string): T {
	const value = map.get(key);
	if (value === undefined) throw new Error(`content bundle: unknown ${what} ${key}`);
	return value;
}

function toRegion(region: BundleRegion, index: number, lang: Lang): Region {
	return withValidTileColor({
		key: region.key,
		order: index + 1,
		name: region.name[lang],
		nameEs: region.name[SPANISH],
		mapLabel: region.mapLabel[lang],
		tileColor: region.tileColor,
		description: region.description[lang],
		regionalDishes: region.regionalDishes
	});
}

function byRegionOrder(variations: BundleVariation[], ctx: Context): BundleVariation[] {
	const order = (v: BundleVariation) => lookup(ctx.regionOrder, v.regionKey, 'region');
	return variations.toSorted((a, b) => order(a) - order(b));
}

function toVariationSummary(v: BundleVariation, ctx: Context): Dish['variations'][number] {
	const region = lookup(ctx.regions, v.regionKey, 'region');
	return {
		regionKey: v.regionKey,
		regionName: region.name[ctx.lang],
		recipeKey: v.recipeKey,
		name: v.name[ctx.lang],
		nameEs: v.name[SPANISH],
		description: v.description[ctx.lang],
		photos: toPhotos(v.photos)
	};
}

function toDish(dish: BundleDish, index: number, ctx: Context): Dish {
	return {
		key: dish.key,
		order: index + 1,
		name: dish.name[ctx.lang],
		nameEs: dish.name[SPANISH],
		description: dish.description[ctx.lang],
		flags: dish.flags,
		course: parseCourse(dish.course),
		season: parseSeason(dish.season),
		photos: toPhotos(dish.photos),
		variations: byRegionOrder(dish.variations, ctx).map((v) => toVariationSummary(v, ctx))
	};
}

function toRegionVariation(dish: BundleDish, v: BundleVariation, ctx: Context) {
	return {
		dishKey: dish.key,
		dishName: dish.name[ctx.lang],
		dishNameEs: dish.name[SPANISH],
		regionKey: v.regionKey,
		recipeKey: v.recipeKey,
		name: v.name[ctx.lang],
		nameEs: v.name[SPANISH],
		description: v.description[ctx.lang],
		photos: toPhotos(v.photos)
	};
}

// The variations cooked in a region, in dish order.
function toRegionDetail(region: Region, ctx: Context): RegionDetail {
	const variations = ctx.bundle.dishes.flatMap((dish) =>
		dish.variations
			.filter((v) => v.regionKey === region.key)
			.map((v) => toRegionVariation(dish, v, ctx))
	);
	return { ...region, variations };
}

function dishRecipes(dish: BundleDish, ctx: Context): [string, Recipe][] {
	return dish.variations.map((v) => [recipePath(dish.key, v.regionKey), toRecipe(dish, v, ctx)]);
}

function toRecipe(dish: BundleDish, v: BundleVariation, ctx: Context): Recipe {
	const recipe = lookup(ctx.recipes, v.recipeKey, 'recipe');
	const { lang } = ctx;
	return {
		dishKey: dish.key,
		dishName: dish.name[lang],
		...toVariationSummary(v, ctx),
		timeMinutes: recipe.timeMinutes,
		timeNote: recipe.timeNote?.[lang] ?? null,
		baseServings: recipe.baseServings,
		ingredients: recipe.ingredients.map((i) => ({
			quantity: i.quantity,
			unit: parseUnit(i.unit),
			name: i.name[lang]
		})),
		steps: recipe.steps.map((step) => step[lang])
	};
}
