<script lang="ts">
	import OverlaySheet from '#lib/components/ui/OverlaySheet.svelte';
	import PrimaryButton from '#lib/components/ui/PrimaryButton.svelte';
	import TextButton from '#lib/components/ui/TextButton.svelte';
	import FilterGroups from '#lib/content/FilterGroups.svelte';
	import { m } from '#lib/paraglide/messages.js';

	// The mobile Filters sheet, controlled: `open` is the screen's (in
	// memory), `active` the URL's filters. A chip or "Clear all" asks the
	// screen to navigate and the sheet stays open; "Show results", the scrim
	// and Escape ask to close it (onClose). No live count: the README and the
	// prototype show none.
	type Props = {
		open: boolean;
		active: readonly string[];
		onToggle: (id: string) => void;
		onClear: () => void;
		onClose: () => void;
	};

	let { open, active, onToggle, onClear, onClose }: Props = $props();
</script>

<div class="mobile-only">
	<OverlaySheet {open} {onClose} label={m.home_filters()}>
		<div class="header">
			<h2 class="title">{m.home_filters()}</h2>
			<TextButton label={m.home_clearAll()} size="small" onclick={onClear} />
		</div>
		<FilterGroups {active} {onToggle} />
		<PrimaryButton label={m.home_showResults()} size="compact" onclick={onClose} />
	</OverlaySheet>
</div>

<style>
	/* Mobile README -> Filters sheet: "Header row: "Filters" (Instrument Serif 23px) + "Clear all""; the prototype centres the row. */
	.header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.title {
		margin: 0;
		font: 400 23px var(--font-display);
	}
</style>
