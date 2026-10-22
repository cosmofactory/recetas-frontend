import { goto } from '$app/navigation';
import type { Locale } from '#lib/i18n/locales.ts';
import { searchResultHref } from '#lib/search/result-href.ts';
import type { SearchEntry } from '#lib/search/search-index.ts';
import { POPULAR, tabHref, type HomeTab } from '#lib/ui/home-tab.ts';

type SearchOrigin = { lang: Locale; tab: HomeTab };

// Mobile README -> Overlay — Search -> Selecting (stage FE-7 -> Small
// decisions). A region pushes its URL (Regional tab, sheet peek), so Back
// returns to where search was opened. A dish or variation first turns the
// current home entry into Popular (no new entry; already on Popular it
// keeps its filters), then pushes the Variations page: one new entry, and
// Back (or the page's back link, whose origin is that entry) lands on Popular.
export async function goToSearchResult(entry: SearchEntry, { lang, tab }: SearchOrigin) {
	const href = searchResultHref(entry, lang, 'mobile');
	// The hrefs go through localizedHref; the app has no paths.base to resolve().
	// eslint-disable-next-line svelte/no-navigation-without-resolve
	if (entry.group === 'region') return goto(href, { reset: false });
	if (tab !== POPULAR) {
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		await goto(tabHref(POPULAR, lang), { replace: true, reset: false });
	}
	// eslint-disable-next-line svelte/no-navigation-without-resolve
	return goto(href);
}
