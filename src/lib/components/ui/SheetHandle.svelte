<script lang="ts">
	// BottomSheet's handle: toggles peek and expanded on a tap or a key, and
	// is a drag zone (data-sheet-drag, D-FE9-1). It has no visible text, so
	// `label` is its accessible name.
	type Props = { label: string; expanded: boolean; onclick: () => void };

	let { label, expanded, onclick }: Props = $props();
</script>

<button
	type="button"
	class="handle"
	data-sheet-drag
	aria-label={label}
	aria-expanded={expanded}
	{onclick}
>
	<span class="bar"></span>
</button>

<style>
	/* "Handle area (padding 10px 0 6px, clickable): 40×4px bar, radius 2px, --border-chip." */
	.handle {
		position: relative;
		display: flex;
		flex: none;
		justify-content: center;
		width: 100%;
		padding: 10px 0 6px;
		border: 0;
		background: transparent;
		cursor: pointer;
	}

	.handle::before {
		content: '';
		position: absolute;
		inset: var(--hit-inset);
	}

	.bar {
		width: 40px;
		height: 4px;
		border-radius: 2px;
		background: var(--border-chip);
	}
</style>
