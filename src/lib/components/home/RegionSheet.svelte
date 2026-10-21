<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import type { ComponentProps } from 'svelte';
	import BottomSheet from '#lib/components/ui/BottomSheet.svelte';
	import RegionDetails from '#lib/content/RegionDetails.svelte';
	import { m } from '#lib/paraglide/messages.js';
	import type { SheetState } from '#lib/ui/sheet.ts';
	import { regionSheetState } from './region-selection.ts';

	type Details = ComponentProps<typeof RegionDetails>;
	// region: the URL's (none: hidden); shown only while `active` (below
	// 860px). onClose asks to leave the region (scrim, Escape).
	type Props = Omit<Details, 'region'> & {
		region: Details['region'] | undefined;
		active: boolean;
		onClose: () => void;
	};

	let { region, active, onClose, ...details }: Props = $props();

	// The handle's toggle stays local: every region URL opens in peek, and so
	// does coming back from the desktop layout.
	let expanded = $state(false);
	afterNavigate(() => (expanded = false));
	$effect.pre(() => {
		if (!active) expanded = false;
	});

	// Prototype lastD: the last region stays in the sheet while it slides out.
	let lastRegion: Details['region'] | undefined;
	const shown = $derived.by(() => (lastRegion = region ?? lastRegion));

	const sheetState = $derived(regionSheetState(region !== undefined && active, expanded));

	function onStateChange(next: SheetState) {
		expanded = next === 'expanded';
		if (next === 'hidden') onClose();
	}
</script>

<div class="mobile-only">
	<BottomSheet
		state={sheetState}
		{onStateChange}
		label={shown?.name ?? ''}
		contentKey={shown?.key}
		handleLabel={m.a11y_sheetHandle()}
	>
		{#if shown}<RegionDetails region={shown} {...details} />{/if}
	</BottomSheet>
</div>
