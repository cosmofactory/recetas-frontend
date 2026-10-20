<script lang="ts">
	import DesktopTopBar from '#lib/components/ui/DesktopTopBar.svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { browseTabs } from './gallery.ts';

	// Dev gallery: the desktop top bar, from 860px only (as it renders).
	// There is no search field or language menu yet (FE-7); the button only
	// toggles its expanded state.
	type Props = { homeHref: string; lang: string };

	let { homeHref, lang }: Props = $props();

	let tab = $state(browseTabs()[0].value);
	let languageOpen = $state(false);
</script>

<section class="desktop-only">
	<h2>{m.devUi_desktopTopBar()}</h2>
	<DesktopTopBar
		{homeHref}
		tabs={{
			options: browseTabs(),
			value: tab,
			label: m.devUi_segmentedSwitch(),
			onChange: (next) => (tab = next)
		}}
		language={{
			label: m.home_language(),
			code: lang,
			expanded: languageOpen,
			onclick: () => (languageOpen = !languageOpen)
		}}
	/>
</section>

<style>
	section {
		display: flex;
		flex-direction: column;
		gap: var(--chip-gap);
	}
</style>
