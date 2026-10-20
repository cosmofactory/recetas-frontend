<script lang="ts">
	import type { Snippet } from 'svelte';

	// The desktop container (F6): the same content snippets as BottomSheet, in
	// an always-visible panel. `label` names it as a region landmark.
	type Props = { label: string; children: Snippet };

	let { label, children }: Props = $props();
</script>

<section class="panel" aria-label={label}>
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
