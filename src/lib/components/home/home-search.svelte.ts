import { tick, untrack } from 'svelte';
import { MediaQuery } from 'svelte/reactivity';
import type { Locale } from '#lib/i18n/locales.ts';
import { cachedIndexBuilder } from '#lib/search/index-cache.ts';
import type { SearchCatalog, SearchEntry } from '#lib/search/search-index.ts';
import { desktopQuery } from '#lib/ui/breakpoints.ts';
import type { HomeTab } from '#lib/ui/home-tab.ts';
import { goToSearchResult } from './search-navigation.ts';

type HomeSearchOptions = {
	catalog: () => SearchCatalog;
	lang: () => Locale;
	tab: () => HomeTab;
	// Called once the overlay has closed because the window widened past
	// 860px: its opener is hidden, so focus would fall to <body>.
	onWiden?: () => void;
};

const NO_ENTRIES: SearchEntry[] = [];

// The home screen's search overlay: open in memory (search isn't a route),
// opened from the mobile header's button, which it returns focus to. The
// index is built only while open, once per catalog and locale. Desktop has
// no overlay (it has the inline search, FE-7 PR 4), so crossing 860px
// closes it and hands focus to onWiden.
// Create during component init.
export class HomeSearch {
	// The overlay needs JavaScript, so it is mounted only once hydrated: the
	// server HTML has no search dialog.
	hydrated = $state(false);
	open = $state(false);
	opener: HTMLElement | undefined = $state();
	readonly #options: HomeSearchOptions;
	readonly #indexFor = cachedIndexBuilder();

	constructor(options: HomeSearchOptions) {
		this.#options = options;
		const desktop = new MediaQuery(desktopQuery, false);
		$effect.pre(() => {
			if (desktop.current && untrack(() => this.open)) this.#closeOnWiden();
		});
		$effect(() => {
			this.hydrated = true;
		});
	}

	get index(): SearchEntry[] {
		if (!this.open) return NO_ENTRIES;
		return this.#indexFor(this.#options.catalog(), this.#options.lang());
	}

	// After the close has flushed, so the overlay's own focus return runs first.
	#closeOnWiden() {
		this.open = false;
		void tick().then(() => this.#options.onWiden?.());
	}

	openFrom = (event: MouseEvent) => {
		if (event.currentTarget instanceof HTMLElement) this.opener = event.currentTarget;
		this.open = true;
	};

	close = () => {
		this.open = false;
	};

	select = (entry: SearchEntry) => {
		this.open = false;
		void goToSearchResult(entry, { lang: this.#options.lang(), tab: this.#options.tab() });
	};
}
