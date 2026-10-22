<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';

	// The Popular tab's "N dishes" eyebrow. It announces each new total
	// (aria-live) and can take focus (tabindex -1) for a screen whose focused
	// control just went away, e.g. the empty state's "Clear all".
	type Props = { count: number };

	let { count }: Props = $props();

	let element: HTMLElement | undefined = $state();

	export function focus() {
		element?.focus();
	}
</script>

<p
	bind:this={element}
	class="result-count"
	data-testid="result-count"
	aria-live="polite"
	tabindex="-1"
>
	{m.home_dish({ count })}
</p>

<style>
	/* Mobile README: the result count is "padding 0 3px ... eyebrow 11px/700, .09em, ink-3". */
	.result-count {
		margin: 0;
		padding: 0 3px;
		color: var(--ink-3);
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.09em;
		text-transform: uppercase;
	}

	/* Desktop prototype: "11.5px/700, .1em, uppercase ... padding-top:10px". */
	@media (min-width: 860px) {
		.result-count {
			padding: 10px 0 0;
			font-size: 11.5px;
			letter-spacing: 0.1em;
		}
	}
</style>
