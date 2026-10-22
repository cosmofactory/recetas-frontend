<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';

	// The empty query's "TRY" eyebrow and suggestion chips; a tap fills the
	// query (mobile README -> Overlay — Search).
	type Props = { onPick: (suggestion: string) => void };

	let { onPick }: Props = $props();

	const suggestions = $derived([
		m.search_suggestions_0(),
		m.search_suggestions_1(),
		m.search_suggestions_2(),
		m.search_suggestions_3(),
		m.search_suggestions_4()
	]);
</script>

<div class="suggestions">
	<p class="eyebrow">{m.search_try()}</p>
	<div class="chips">
		{#each suggestions as suggestion (suggestion)}
			<button type="button" class="chip" onclick={() => onPick(suggestion)}>{suggestion}</button>
		{/each}
	</div>
</div>

<style>
	/* Prototype: "flex-direction:column;gap:10px;padding-top:8px". */
	.suggestions {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding-top: 8px;
	}

	/* "10.5px/700, letter-spacing .11em, upper case"; --ink-eyebrow is the AA override. */
	.eyebrow {
		margin: 0;
		color: var(--ink-eyebrow);
		font: 700 10.5px var(--font-text);
		letter-spacing: 0.11em;
		text-transform: uppercase;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	/* "padding:9px 14px;border:1px solid rgba(43,30,22,.2);border-radius:999px;font-size:13px;font-weight:500". */
	.chip {
		position: relative;
		padding: 9px 14px;
		border: 1px solid var(--border-search-chip);
		border-radius: var(--radius-pill);
		background: transparent;
		color: var(--ink);
		font: 500 13px var(--font-text);
		cursor: pointer;
		transition: background-color var(--dur-colour);
	}

	.chip::before {
		content: '';
		position: absolute;
		inset: var(--hit-inset);
	}

	@media (hover: hover) {
		.chip:hover {
			background: var(--bg-search-chip-hover);
		}
	}
</style>
