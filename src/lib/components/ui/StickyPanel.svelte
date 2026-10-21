<script lang="ts">
	import type { Snippet } from 'svelte';
	import { scrollToTopOn } from '#lib/ui/scroll-reset.svelte.ts';

	// The desktop container (F6): the same content snippets as BottomSheet, in
	// an always-visible panel. `label` names it as a region landmark; a new
	// `contentKey` scrolls it back to the top.
	type Props = { label: string; contentKey?: unknown; children: Snippet };

	let { label, contentKey, children }: Props = $props();

	let panel: HTMLElement | undefined = $state();
	scrollToTopOn(
		() => contentKey,
		() => panel
	);
</script>

<section class="panel" aria-label={label} bind:this={panel}>
	{@render children()}
</section>

<style>
	/* Desktop README -> Regional: region panel; the prototype adds the border and min-height. */
	.panel {
		position: sticky;
		top: var(--panel-top);
		height: calc(100vh - var(--panel-height-offset));
		min-height: var(--panel-min-height);
		overflow-y: auto;
		padding: var(--panel-padding);
		border: 1px solid var(--border-card);
		border-radius: var(--radius-panel);
		background: var(--bg-surface);
	}
</style>
