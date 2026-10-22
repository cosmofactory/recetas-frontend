import type { ComponentProps } from 'svelte';
import { MediaQuery } from 'svelte/reactivity';
import { goto } from '$app/navigation';
import type { Locale } from '#lib/i18n/locales.ts';
import { cachedIndexBuilder } from '#lib/search/index-cache.ts';
import { searchResultHref } from '#lib/search/result-href.ts';
import type { SearchCatalog, SearchEntry } from '#lib/search/search-index.ts';
import { desktopQuery } from '#lib/ui/breakpoints.ts';
import type DesktopSearch from './DesktopSearch.svelte';

type DesktopSearchOptions = {
	catalog: () => SearchCatalog;
	lang: () => Locale;
};

const NO_ENTRIES: SearchEntry[] = [];

// One screen's desktop top-bar search (stage FE-7 PR 4): the dropdown is
// open in memory and closes when the 860px switch hides the top bar. The
// index is built on the first opening, once per catalog and locale, and
// kept, so a closing dropdown keeps its rows while it fades. A pick is one
// plain push (no Popular replace, unlike mobile); a variation opens its
// recipe. Create during component init.
export class DesktopSearchState {
	open = $state(false);
	field: HTMLInputElement | undefined = $state();
	#used = $state(false);
	readonly #options: DesktopSearchOptions;
	readonly #indexFor = cachedIndexBuilder();

	constructor(options: DesktopSearchOptions) {
		this.#options = options;
		const desktop = new MediaQuery(desktopQuery, false);
		$effect.pre(() => {
			if (!desktop.current) this.open = false;
		});
	}

	get props(): Omit<ComponentProps<typeof DesktopSearch>, 'input'> {
		return {
			open: this.open,
			index: this.#index,
			onOpen: this.#show,
			onClose: this.#close,
			onSelect: this.#select
		};
	}

	// Focus the field (the mobile overlay hands focus over when the window
	// widens past 860px); focusing it opens the dropdown, as a click does.
	focusField() {
		this.field?.focus();
	}

	get #index(): SearchEntry[] {
		if (!this.#used) return NO_ENTRIES;
		return this.#indexFor(this.#options.catalog(), this.#options.lang());
	}

	#show = () => {
		this.#used = true;
		this.open = true;
	};

	#close = () => {
		this.open = false;
	};

	#select = (entry: SearchEntry) => {
		this.open = false;
		const href = searchResultHref(entry, this.#options.lang(), 'desktop');
		// searchResultHref goes through localizedHref; the app has no paths.base to resolve().
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		void goto(href);
	};
}
