<script lang="ts">
	import BottomSheet from '#lib/components/ui/BottomSheet.svelte';
	import OverlaySheet from '#lib/components/ui/OverlaySheet.svelte';
	import type { SheetState } from '#lib/ui/sheet.ts';

	// Test harness (FE-3): an OverlaySheet rendered inside a BottomSheet's
	// content, as a screen may compose them. Labels come in as props.
	type Props = {
		sheetState: SheetState;
		overlayOpen: boolean;
		onStateChange: (next: SheetState) => void;
		onClose: () => void;
		labels: { sheet: string; handle: string; overlay: string; controls: string[] };
	};

	let { sheetState, overlayOpen, onStateChange, onClose, labels }: Props = $props();
</script>

<BottomSheet state={sheetState} {onStateChange} label={labels.sheet} handleLabel={labels.handle}>
	<OverlaySheet open={overlayOpen} {onClose} label={labels.overlay}>
		{#each labels.controls as control (control)}
			<button type="button">{control}</button>
		{/each}
	</OverlaySheet>
</BottomSheet>
