import { variationsHref } from '#lib/i18n/localized-href.ts';
import { localeFromPath } from '#lib/i18n/locales.ts';
import { dishSheetHref, type FilterUrl } from './filters.ts';

export type CardLayout = 'mobile' | 'desktop';

// A Popular dish card's link (stage FE-5 -> Small decisions, card hrefs).
// Mobile opens the dish sheet over the same filtered list (D-FE5-2); desktop
// has no dish sheet and goes straight to the Variations page, which has no
// filters (Back restores them from history). The server can't know the
// width, so it renders the desktop link: it works without JavaScript on both
// layouts and gives crawlers a link to every Variations page.
export function dishCardHref(url: FilterUrl, dishKey: string, layout: CardLayout): string {
	if (layout === 'mobile') return dishSheetHref(url, dishKey);
	return variationsHref(dishKey, localeFromPath(url.pathname));
}
