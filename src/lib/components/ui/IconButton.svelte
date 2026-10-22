<script lang="ts">
	import { ICONS, ICON_SIZE_PX, type IconName } from './icons.ts';

	type Props = {
		icon: IconName;
		// The accessible name (a message); the icon is the only visible content.
		label: string;
		onclick?: (event: MouseEvent) => void;
		// The popup it opens (e.g. the search overlay's dialog) and whether
		// that is open; both left off for a plain action.
		haspopup?: 'dialog' | 'menu';
		expanded?: boolean;
	};

	let { icon, label, onclick, haspopup, expanded }: Props = $props();

	const Icon = $derived(ICONS[icon]);
</script>

<button
	type="button"
	class="icon-button"
	aria-label={label}
	aria-haspopup={haspopup}
	aria-expanded={expanded}
	{onclick}
>
	<Icon size={ICON_SIZE_PX} aria-hidden={true} />
</button>

<style>
	/* Mobile README -> Header: "40×40 circle, 1.5px border --border-chip". */
	.icon-button {
		position: relative;
		display: inline-flex;
		flex: none;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		padding: 0;
		border: 1.5px solid var(--border-chip);
		border-radius: var(--radius-pill);
		background: transparent;
		color: var(--ink);
		cursor: pointer;
		transition: background-color var(--dur-colour);
	}

	.icon-button::before {
		content: '';
		position: absolute;
		inset: var(--hit-inset);
	}

	@media (hover: hover) {
		.icon-button:hover {
			background: var(--bg-hover-subtle);
		}
	}
</style>
