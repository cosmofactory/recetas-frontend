<script lang="ts">
	// The dimming layer behind a sheet. It covers its positioned container and
	// takes taps only while visible; it is decoration for pointer users, so
	// assistive tech never sees it (Escape is the keyboard way out).
	type Props = {
		variant?: 'sheet' | 'filter';
		// 0 hides it.
		opacity: number;
		onclick?: () => void;
	};

	let { variant = 'sheet', opacity, onclick }: Props = $props();
</script>

<div
	class="scrim"
	class:filter={variant === 'filter'}
	class:visible={opacity > 0}
	style:opacity
	aria-hidden="true"
	{onclick}
></div>

<style>
	/* Mobile README -> Region sheet: "Scrim behind the sheet: --scrim, ... 400ms". */
	.scrim {
		position: absolute;
		inset: 0;
		background: var(--scrim);
		pointer-events: none;
		transition: opacity var(--dur-scrim);
	}

	/* Filters sheet: "Scrim --scrim-filter, 300ms, tap closes." */
	.filter {
		background: var(--scrim-filter);
		transition-duration: var(--dur-scrim-filter);
	}

	.visible {
		pointer-events: auto;
	}
</style>
