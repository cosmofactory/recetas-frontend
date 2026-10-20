import { localizedHref } from '#lib/i18n/localized-href.ts';

// Both READMEs -> State: "tab: 'regional' | 'popular'", default Regional.
// The tab lives in the URL: Popular is /:lang/?tab=popular, Regional has no
// param, and any other value reads as Regional. A region URL always shows
// Regional (`?tab` is ignored there).
export type HomeTab = 'regional' | 'popular';

export const REGIONAL: HomeTab = 'regional';
export const POPULAR: HomeTab = 'popular';
export const HOME_TABS: readonly HomeTab[] = [REGIONAL, POPULAR];

export const TAB_PARAM = 'tab';

type HomeUrl = { searchParams: Pick<URLSearchParams, 'get'> };

// regionKey: the selected region's key when on /:lang/regions/:regionKey.
export function tabFromUrl(url: HomeUrl, regionKey?: string): HomeTab {
	if (regionKey !== undefined) return REGIONAL;
	return url.searchParams.get(TAB_PARAM) === POPULAR ? POPULAR : REGIONAL;
}

// "Switching tabs closes any open sheet": a tab's URL is always the bare
// home, so switching from /:lang/regions/:key lands on /:lang/?tab=popular.
export function tabHref(tab: HomeTab, lang: string): string {
	const path = tab === POPULAR ? `/?${new URLSearchParams({ [TAB_PARAM]: POPULAR })}` : '/';
	return localizedHref(path, lang);
}

export const isHomeTab = (value: string): value is HomeTab =>
	(HOME_TABS as readonly string[]).includes(value);

// The tabpanel ids; a tab is `${panelId}-tab` (SegmentedSwitch), which
// labels its panel. Only one of the two rendered switches carries them.
export const TAB_PANEL_IDS: Record<HomeTab, string> = {
	regional: 'home-regional',
	popular: 'home-popular'
};

export const tabIdFor = (tab: HomeTab) => `${TAB_PANEL_IDS[tab]}-tab`;
