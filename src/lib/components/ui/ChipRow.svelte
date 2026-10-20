<script lang="ts">
	import type { Snippet } from 'svelte';

	// Localization -> Length: chips never truncate, so the filter bar scrolls
	// sideways; the Filters sheet wraps instead (`wrap`).
	type Props = { children: Snippet; wrap?: boolean };

	let { children, wrap = false }: Props = $props();
</script>

<div class="chip-row" class:wrap>
	{@render children()}
</div>

<style>
	/*
	 * Mobile README: "horizontally scrolling row, gap 7px, scrollbar hidden".
	 * A scroller clips on both axes, so the row is as tall as a chip's hit
	 * area, with the chips centred in it, and has inline room for the end
	 * chips' focus rings, taken back by a negative margin so it doesn't move.
	 */
	.chip-row {
		--ring-room: calc(var(--focus-ring-width) + var(--focus-ring-offset));
		display: flex;
		flex-wrap: nowrap;
		align-items: center;
		gap: var(--chip-gap);
		min-height: var(--hit-min);
		margin-inline: calc(-1 * var(--ring-room));
		padding-inline: var(--ring-room);
		overflow-x: auto;
		scrollbar-width: none;
	}

	.chip-row::-webkit-scrollbar {
		display: none;
	}

	/*
	 * Filters sheet: "wrapping chip row (gap 7px)". A 44px hit area would
	 * overlap the next line, so chips extend only half the gap above and below
	 * (stage FE-3 -> Acceptance, hit-area exception).
	 */
	.chip-row.wrap {
		--chip-hit-extend-block: calc(var(--chip-gap) / 2);
		flex-wrap: wrap;
		min-height: 0;
		margin-inline: 0;
		padding-inline: 0;
		overflow: visible;
	}
</style>
