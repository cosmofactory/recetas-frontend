<script lang="ts">
	import type { Snippet } from 'svelte';
	import { TAB_PANEL_IDS, tabIdFor, type HomeTab } from '#lib/ui/home-tab.ts';

	// Both panels are always in the page, so every tab's aria-controls points
	// at one; only the selected tab's panel renders its content.
	type Props = { tab: HomeTab; selected: boolean; children?: Snippet };

	let { tab, selected, children }: Props = $props();
</script>

<div
	class="tab-panel"
	role="tabpanel"
	id={TAB_PANEL_IDS[tab]}
	aria-labelledby={tabIdFor(tab)}
	hidden={!selected}
>
	{#if selected}{@render children?.()}{/if}
</div>

<style>
	/* Fills the home frame under the header. */
	.tab-panel {
		display: flex;
		flex: 1;
		flex-direction: column;
		min-height: 0;
	}

	.tab-panel[hidden] {
		display: none;
	}
</style>
