import { tabLabel } from '#lib/components/home/home-header.ts';
import { variationsHref } from '#lib/i18n/localized-href.ts';
import { POPULAR, tabHref } from '#lib/ui/home-tab.ts';
import type { BackOrigin } from '#lib/ui/back-origin.ts';

export type BackPillLink = { label: string; href: string };

type RecipeNames = { dishKey: string; dishName: string; regionName: string };

type Named = { key: string; name: string };

// The [lang=lang] layout's lists, which name the page an origin URL is.
export type OriginCatalog = { dishes: readonly Named[]; regions: readonly Named[] };

// /:lang/dishes/:dishKey or /:lang/regions/:regionKey (and below).
const ORIGIN_PAGE = /^\/[^/]+\/(dishes|regions)\/([^/?#]+)/;

// Stage FE-6 -> Small decisions (desktop prototype dishBack): the home tab
// the page came from, or on a direct load "‹ Popular" to /:lang/?tab=popular.
export function variationsBackPill(origin: BackOrigin | null, lang: string): BackPillLink {
	if (!origin) return { label: tabLabel(POPULAR), href: tabHref(POPULAR, lang) };
	return { label: tabLabel(origin.tab), href: origin.href };
}

// Desktop prototype recipeBack: on a direct load the dish name, to its
// Variations page. Else the label names the page the href goes to (stage
// FE-7 -> Small decisions: a search pick can open another dish's recipe):
// a Variations page by its dish, a region by its region, the home by its tab.
export function recipeBackPill(
	origin: BackOrigin | null,
	recipe: RecipeNames,
	lang: string,
	catalog: OriginCatalog
): BackPillLink {
	if (!origin) return { label: recipe.dishName, href: variationsHref(recipe.dishKey, lang) };
	return { label: originPageName(origin, catalog) ?? tabLabel(origin.tab), href: origin.href };
}

function originPageName(origin: BackOrigin, catalog: OriginCatalog): string | undefined {
	const match = ORIGIN_PAGE.exec(origin.href);
	if (!match) return undefined;
	const [, kind, key] = match;
	const list = kind === 'dishes' ? catalog.dishes : catalog.regions;
	return list.find((entry) => entry.key === key)?.name;
}
