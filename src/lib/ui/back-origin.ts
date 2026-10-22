import { POPULAR, tabFromUrl, type HomeTab } from './home-tab.ts';
import { depthOf, HOME_DEPTH, pageDirection, type PageNavigation } from './page-push.ts';

// Stage FE-6 -> Small decisions (desktop prototype dishBack / recipeBack /
// goBack): a Variations or Recipe entry remembers the in-app page it was
// pushed from. href: that entry's URL (path and query), where the back pill
// goes. from: the home (or a region) or the Variations page. tab: the home
// tab the page belongs to, which the desktop top bar shows: the home's own
// tab, or, from Variations, the tab the Variations entry showed (the
// prototype's `tab` carries over).
export type BackOrigin = { href: string; from: 'home' | 'variations'; tab: HomeTab };

type OriginTarget = {
	route: { id: string | null };
	url: URL;
	params: Record<string, string> | null;
};

export type OriginNavigation = PageNavigation & { from: OriginTarget | null };

// A direct load (or any entry without an in-app origin) belongs to Popular,
// where the Variations page's direct-load back link goes.
export const DIRECT_LOAD_TAB: HomeTab = POPULAR;

export const originTab = (origin: BackOrigin | null): HomeTab => origin?.tab ?? DIRECT_LOAD_TAB;

// Only a forward push from a shallower route records an origin (the same
// rule as inAppBack's history.back()); fromTab is the tab the page being
// left showed, which a push from Variations carries over.
export function recordOrigin(navigation: OriginNavigation, fromTab: HomeTab): BackOrigin | null {
	const from = navigation.from;
	if (pageDirection(navigation) !== 'push' || !from) return null;
	const href = from.url.pathname + from.url.search;
	if (depthOf(from) !== HOME_DEPTH) return { href, from: 'variations', tab: fromTab };
	return { href, from: 'home', tab: tabFromUrl(from.url, from.params?.regionKey) };
}
