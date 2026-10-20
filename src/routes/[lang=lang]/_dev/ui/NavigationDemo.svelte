<script lang="ts">
	import BackPill from '#lib/components/ui/BackPill.svelte';
	import StickyTopBar from '#lib/components/ui/StickyTopBar.svelte';
	import { m } from '#lib/paraglide/messages.js';

	// Dev gallery: the FE-3 navigation controls. The top bar sits in its own
	// scroller, so scrolling that box past the Variations threshold shows its
	// title and hairline.
	type Props = { title: string; homeHref: string; popularHref: string };

	let { title, homeHref, popularHref }: Props = $props();

	// Mobile README -> Screen 2: "once scrolled past 230px".
	const VARIATIONS_THRESHOLD_PX = 230;

	let scroller: HTMLElement | undefined = $state();
</script>

<section>
	<h2>{m.devUi_navigation()}</h2>
	<div class="scroller" bind:this={scroller}>
		<StickyTopBar
			backHref={homeHref}
			backLabel={m.a11y_back()}
			{title}
			threshold={VARIATIONS_THRESHOLD_PX}
			scrollContainer={scroller}
		/>
		<div class="page"></div>
	</div>
	<BackPill label={m.home_popular()} href={popularHref} />
</section>

<style>
	section {
		display: flex;
		flex-direction: column;
		gap: var(--chip-gap);
	}

	/* Stands in for a phone-height Variations page. */
	.scroller {
		height: var(--sheet-height);
		overflow-y: auto;
		background: var(--bg-surface);
	}

	.page {
		height: 300vh;
	}
</style>
