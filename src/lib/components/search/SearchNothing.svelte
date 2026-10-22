<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';

	// No results: `{nothing} “{query}”`, curly quotes in every language
	// (stage FE-7 -> Small decisions, as the prototype), and the hint.
	type Props = { query: string };

	let { query }: Props = $props();
</script>

<div class="nothing">
	<p class="title">{m.search_nothing()} “{query}”</p>
	<p class="hint">{m.search_hint()}</p>
</div>

<style>
	/* "centred "Nothing for "query"" (22px serif) + hint (12.5px ink-3)"; prototype gap 6px. */
	.nothing {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding-top: 40px;
		text-align: center;
	}

	p {
		margin: 0;
	}

	.title {
		font: 400 22px var(--font-display);
	}

	.hint {
		color: var(--ink-3);
		font-size: 12.5px;
	}
</style>
