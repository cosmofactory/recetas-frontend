<script lang="ts">
	// Controlled: a click asks the caller to flip it; the state lives in the URL.
	type Props = { label: string; pressed: boolean; onToggle: (pressed: boolean) => void };

	let { label, pressed, onToggle }: Props = $props();
</script>

<button type="button" class="chip" aria-pressed={pressed} onclick={() => onToggle(!pressed)}>
	{label}
</button>

<style>
	/* Mobile README -> Popular tab -> Filter bar: "pill, padding 8px 13px, 12px/600, 1px border". */
	.chip {
		--chip-border: 1px;
		position: relative;
		flex: none;
		padding: 8px 13px;
		border: var(--chip-border) solid var(--border-chip);
		border-radius: var(--radius-pill);
		background: transparent;
		color: var(--ink);
		font: 600 12px var(--font-text);
		white-space: nowrap;
		cursor: pointer;
		transition:
			background-color var(--dur-colour),
			border-color var(--dur-colour),
			color var(--dur-colour);
	}

	/*
	 * "chips may be 34px tall visually; extend the hit area": the border box
	 * (corners included) grown to --hit-min on each axis. A wrapping ChipRow
	 * sets --chip-hit-extend-block to keep vertical neighbours from overlapping.
	 * The insets are from the padding box, hence the border term.
	 */
	.chip::before {
		--hit-extend: max(0px, calc((var(--hit-min) - 100%) / 2 - var(--chip-border)));
		content: '';
		position: absolute;
		inset-inline: calc(-1 * var(--chip-border) - var(--hit-extend));
		inset-block: calc(-1 * var(--chip-border) - var(--chip-hit-extend-block, var(--hit-extend)));
	}

	.chip[aria-pressed='true'] {
		border-color: var(--ink);
		background: var(--ink);
		color: var(--on-accent);
	}
</style>
