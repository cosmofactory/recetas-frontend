import { tabLabel } from '#lib/components/home/home-header.ts';
import { variationsHref } from '#lib/i18n/localized-href.ts';
import { POPULAR, tabHref } from '#lib/ui/home-tab.ts';
import type { BackOrigin } from '#lib/ui/back-origin.ts';

export type BackPillLink = { label: string; href: string };

type RecipeNames = { dishKey: string; dishName: string; regionName: string };

// Stage FE-6 -> Small decisions (desktop prototype dishBack): the home tab
// the page came from, or on a direct load "‹ Popular" to /:lang/?tab=popular.
export function variationsBackPill(origin: BackOrigin | null, lang: string): BackPillLink {
	if (!origin) return { label: tabLabel(POPULAR), href: tabHref(POPULAR, lang) };
	return { label: tabLabel(origin.tab), href: origin.href };
}

// Desktop prototype recipeBack: the dish name from its Variations page (and
// on a direct load, to that page), else Popular or the recipe's region.
export function recipeBackPill(
	origin: BackOrigin | null,
	recipe: RecipeNames,
	lang: string
): BackPillLink {
	if (!origin) return { label: recipe.dishName, href: variationsHref(recipe.dishKey, lang) };
	return { label: recipeOriginLabel(origin, recipe), href: origin.href };
}

function recipeOriginLabel(origin: BackOrigin, recipe: RecipeNames): string {
	if (origin.from === 'variations') return recipe.dishName;
	return origin.tab === POPULAR ? tabLabel(POPULAR) : recipe.regionName;
}
