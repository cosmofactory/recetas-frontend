<script lang="ts" generics="T extends { key: string; name: string }">
	import { afterNavigate } from '$app/navigation';
	import type { Snippet } from 'svelte';
	import BottomSheet from '#lib/components/ui/BottomSheet.svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { urlSheetState, type SheetState } from '#lib/ui/sheet.ts';

	// The mobile sheet for what the URL opens (a region, a dish): `item` opens
	// it (none: hidden), named by it; shown only while `active` (below 860px).
	// onClose asks to leave it (scrim, Escape); `opener`, when known, gets
	// focus back once it hides.
	type Props = {
		item: T | undefined;
		active: boolean;
		onClose: () => void;
		opener?: () => HTMLElement | undefined;
		content: Snippet<[T]>;
	};

	let { item, active, onClose, opener, content }: Props = $props();

	// The handle's toggle stays local: every URL opens in peek, and so does
	// coming back from the desktop layout.
	let expanded = $state(false);
	afterNavigate(() => (expanded = false));
	$effect.pre(() => {
		if (!active) expanded = false;
	});

	// Prototype lastD: the last item stays in the sheet while it slides out.
	let lastItem: T | undefined;
	const shown = $derived.by(() => (lastItem = item ?? lastItem));

	const sheetState = $derived(urlSheetState(item !== undefined && active, expanded));

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
		{opener}
	>
		{#if shown}{@render content(shown)}{/if}
	</BottomSheet>
</div>
