<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import HomeTabPanel from '#lib/components/home/HomeTabPanel.svelte';
	import MobileHeader from '#lib/components/home/MobileHeader.svelte';
	import RegionalTab from '#lib/components/home/RegionalTab.svelte';
	import { tabOptions } from '#lib/components/home/home-header.ts';
	import DesktopTopBar from '#lib/components/ui/DesktopTopBar.svelte';
	import { localeFromPath } from '#lib/i18n/locales.ts';
	import { localizedHref } from '#lib/i18n/localized-href.ts';
	import { m } from '#lib/paraglide/messages.js';
	import { isHomeTab, POPULAR, REGIONAL, tabFromUrl, tabHref } from '#lib/ui/home-tab.ts';
	import type { LayoutProps } from './$types';

	// Home and /:lang/regions/:regionKey share this layout, so moving between
	// them keeps the header and the map mounted (stage FE-4).
	let { children, data }: LayoutProps = $props();

	const lang = $derived(localeFromPath(page.url.pathname));
	const tab = $derived(tabFromUrl(page.url, page.params.regionKey));
	const hrefFor = (regionKey: string) => localizedHref(`/regions/${regionKey}`, lang);

	// The tabs are links (a click is a new history entry); onChange comes
	// only from arrow keys, which replace the entry. reset: false keeps focus
	// on the tab and the scroll.
	function replaceTab(next: string) {
		if (!isHomeTab(next)) return;
		// tabHref goes through localizedHref; the app has no paths.base to resolve().
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		void goto(tabHref(next, lang), { replace: true, reset: false });
	}

	const tabs = $derived({ value: tab, label: m.a11y_homeTabs(), onChange: replaceTab });
	// Until the language menu arrives (FE-7) the button opens nothing.
	const language = $derived({ code: lang, label: m.home_language(), expanded: false });
</script>

<div class="home">
	<MobileHeader
		tabs={{ ...tabs, options: tabOptions(lang, true) }}
		{language}
		searchLabel={m.a11y_search()}
	/>
	<DesktopTopBar
		homeHref={localizedHref('/', lang)}
		tabs={{ ...tabs, options: tabOptions(lang, false) }}
		{language}
	/>
	<HomeTabPanel tab={REGIONAL} selected={tab === REGIONAL}>
		<RegionalTab regions={data.regions} selectedKey={page.params.regionKey} {hrefFor} />
	</HomeTabPanel>
	<!-- The Popular tab arrives with FE-5. -->
	<HomeTabPanel tab={POPULAR} selected={tab === POPULAR} />
	{@render children()}
</div>

<style>
	/*
	 * CLAUDE.md screen frame contract: on mobile the home is a viewport-sized,
	 * positioned frame with overflow hidden (the region sheet lives in it).
	 * On desktop the page scrolls when the viewport is short.
	 */
	.home {
		position: relative;
		display: flex;
		flex-direction: column;
		min-height: 100dvh;
	}

	@media not all and (min-width: 860px) {
		.home {
			height: 100dvh;
			overflow: hidden;
		}
	}
</style>
