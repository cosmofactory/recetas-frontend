<script lang="ts">
	import { tabOptions } from '#lib/components/home/home-header.ts';
	import DesktopTopBar from '#lib/components/ui/DesktopTopBar.svelte';
	import { localizedHref } from '#lib/i18n/localized-href.ts';
	import { m } from '#lib/paraglide/messages.js';
	import type { HomeTab } from '#lib/ui/home-tab.ts';

	// Stage FE-6 -> Small decisions: the Variations and Recipe pages show the
	// home's desktop top bar (not sticky). tab: the origin tab, which the
	// switch shows; its tabs link to the home tabs. Arrow keys only move
	// focus (manual activation), so leaving the page takes Enter or a click.
	type Props = { lang: string; tab: HomeTab };

	let { lang, tab }: Props = $props();

	const tabs = $derived({
		options: tabOptions(lang, false),
		value: tab,
		label: m.a11y_homeTabs(),
		activation: 'manual' as const
	});
	// Until the language menu arrives (FE-7) the button opens nothing.
	const language = $derived({ code: lang, label: m.home_language(), expanded: false });
</script>

<DesktopTopBar homeHref={localizedHref('/', lang)} {tabs} {language} />
