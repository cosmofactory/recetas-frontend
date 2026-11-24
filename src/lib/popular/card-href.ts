import { hasVariationsPage, type VariationTarget } from '#lib/content/dish-variations.ts';
import { dishHref } from '#lib/i18n/localized-href.ts';
import { localeFromPath } from '#lib/i18n/locales.ts';
import { dishSheetHref, type FilterUrl } from './filters.ts';

export type CardLayout = 'mobile' | 'desktop';
export type CardDish = { key: string; variations: readonly VariationTarget[] };

// A Popular dish card's link (stage FE-5 -> Small decisions, card hrefs).
// Mobile opens the dish sheet over the same filtered list (D-FE5-2); desktop
// has no dish sheet and goes straight to the Variations page, which has no
// filters (Back restores them from history). The server can't know the
// width, so it renders the desktop link: it works without JavaScript on both
// layouts and gives crawlers a link to every Variations page. A dish with
// one variation has neither a sheet nor a Variations page: its card opens
// the recipe on both layouts (FE-11).

export function dishCardHref(url: FilterUrl, dish: CardDish, layout: CardLayout): string {
	if (layout === 'mobile' && hasVariationsPage(dish)) return dishSheetHref(url, dish.key);
	return dishHref(dish, localeFromPath(url.pathname));
}
