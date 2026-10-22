<script lang="ts">
	import { tabOptions } from '#lib/components/home/home-header.ts';
	import DesktopSearch from '#lib/components/search/DesktopSearch.svelte';
	import { DesktopSearchState } from '#lib/components/search/desktop-search.svelte.ts';
	import DesktopTopBar from '#lib/components/ui/DesktopTopBar.svelte';
	import LanguageMenu from '#lib/components/ui/LanguageMenu.svelte';
	import { LanguageMenuState } from '#lib/components/ui/language-menu.svelte.ts';
	import type { Locale } from '#lib/i18n/locales.ts';
	import { localizedHref } from '#lib/i18n/localized-href.ts';
	import type { PageLocation } from '#lib/i18n/set-lang.ts';
	import { m } from '#lib/paraglide/messages.js';
	import type { SearchCatalog } from '#lib/search/search-index.ts';
	import type { HomeTab } from '#lib/ui/home-tab.ts';

	// Stage FE-6 -> Small decisions: the Variations and Recipe pages show the
	// home's desktop top bar (not sticky). tab: the origin tab, which the
	// switch shows; its tabs link to the home tabs. Arrow keys only move
	// focus (manual activation), so leaving the page takes Enter or a click.
	// url: the page URL, which the language menu keeps in each locale.
	// catalog: the [lang=lang] layout's lists, which the search runs over.
	type Props = { lang: Locale; tab: HomeTab; url: PageLocation; catalog: SearchCatalog };

	let { lang, tab, url, catalog }: Props = $props();

	const tabs = $derived({
		options: tabOptions(lang, false),
		value: tab,
		label: m.a11y_homeTabs(),
		activation: 'manual' as const
	});
	const language = new LanguageMenuState('desktop');
	const desktopSearch = new DesktopSearchState({ catalog: () => catalog, lang: () => lang });
</script>

<DesktopTopBar homeHref={localizedHref('/', lang)} {tabs} language={language.button(lang)}>
	{#snippet search()}
		<DesktopSearch {...desktopSearch.props} />
	{/snippet}
	{#snippet languageMenu()}
		<LanguageMenu {...language.menu(lang, url)} />
	{/snippet}
</DesktopTopBar>
