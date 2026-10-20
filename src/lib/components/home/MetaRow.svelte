<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';

	// regionCount: how many regions the API returned (the eyebrow's plural).
	type Props = { regionCount: number };

	let { regionCount }: Props = $props();
</script>

<div class="meta-row">
	<span class="eyebrow">{m.home_region({ count: regionCount })}</span>
	<span class="hint mobile-only">{m.home_tapRegion()}</span>
	<span class="hint desktop-only">{m.desktop_clickRegion()}</span>
</div>

<style>
	/*
	 * Mobile README -> Regional tab: "Meta row (padding 0 4px, space-between,
	 * baseline): left "14 REGIONS" eyebrow (11px/600, .1em, ink-3 at .55);
	 * right hint "Tap a region to preview", 11.5px ink-3".
	 */
	.meta-row {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		padding: 0 4px;
	}

	.eyebrow {
		color: var(--ink-eyebrow);
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.hint {
		color: var(--ink-3);
		font-size: 11.5px;
	}

	/* Desktop prototype: eyebrow "font-size:11.5px;font-weight:700;letter-spacing:.11em", hint "font-size:13px". */
	@media (min-width: 860px) {
		.eyebrow {
			font-size: 11.5px;
			font-weight: 700;
			letter-spacing: 0.11em;
		}

		.hint {
			font-size: 13px;
		}
	}
</style>
