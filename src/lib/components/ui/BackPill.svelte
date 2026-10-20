<script lang="ts">
	import { ICONS } from './icons.ts';

	// Desktop README -> Variations / Recipe page: "back pill". The label
	// names where it goes back to (navigation origin, FE-6).
	type Props = { label: string; href: string; onclick?: (event: MouseEvent) => void };

	let { label, href, onclick }: Props = $props();

	// Desktop prototype: the "‹" is 18px.
	const BACK_ICON_PX = 18;
	const Back = ICONS.back;
</script>

<a class="back-pill" {href} {onclick}>
	<Back size={BACK_ICON_PX} aria-hidden={true} />
	{label}
</a>

<style>
	/* Desktop prototype (both pills); it is as wide as its content. */
	.back-pill {
		position: relative;
		display: flex;
		align-self: flex-start;
		align-items: center;
		gap: 8px;
		width: fit-content;
		padding: 8px 16px 8px 12px;
		border-radius: var(--radius-pill);
		background: var(--bg-hover-subtle);
		color: var(--ink);
		font: 600 13px var(--font-text);
		white-space: nowrap;
		text-decoration: none;
		transition: background-color var(--dur-colour);
	}

	.back-pill::before {
		content: '';
		position: absolute;
		inset: var(--hit-inset);
	}

	@media (hover: hover) {
		.back-pill:hover {
			background: var(--bg-back-pill-hover);
		}
	}
</style>
