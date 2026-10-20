<script lang="ts">
	import BottomSheet from '#lib/components/ui/BottomSheet.svelte';
	import OverlaySheet from '#lib/components/ui/OverlaySheet.svelte';
	import PrimaryButton from '#lib/components/ui/PrimaryButton.svelte';
	import StickyPanel from '#lib/components/ui/StickyPanel.svelte';
	import TextButton from '#lib/components/ui/TextButton.svelte';
	import { m } from '#lib/paraglide/messages.js';
	import type { SheetState } from '#lib/ui/sheet.ts';

	// Dev gallery: the FE-3 containers around one sample content snippet.
	type Props = { title: string; body: string };

	let { title, body }: Props = $props();

	let sheetState: SheetState = $state('peek');
	let overlayOpen = $state(false);

	const sheetStates = (): { value: SheetState; label: string }[] => [
		{ value: 'hidden', label: m.devUi_sheetHidden() },
		{ value: 'peek', label: m.devUi_sheetPeek() },
		{ value: 'expanded', label: m.devUi_sheetExpanded() }
	];
</script>

{#snippet sample()}
	<div>
		<h3>{title}</h3>
		<p>{body}</p>
	</div>
{/snippet}

<section>
	<h2>{m.devUi_containers()}</h2>
	<div class="row">
		{#each sheetStates() as { value, label } (value)}
			<TextButton {label} onclick={() => (sheetState = value)} />
		{/each}
		<TextButton label={m.devUi_openOverlay()} onclick={() => (overlayOpen = true)} />
	</div>
	<div class="frame">
		<BottomSheet
			state={sheetState}
			onStateChange={(next) => (sheetState = next)}
			label={title}
			handleLabel={m.a11y_sheetHandle()}
		>
			{@render sample()}
		</BottomSheet>
		<OverlaySheet open={overlayOpen} onClose={() => (overlayOpen = false)} label={title}>
			{@render sample()}
			<PrimaryButton
				label={m.home_showResults()}
				size="compact"
				onclick={() => (overlayOpen = false)}
			/>
		</OverlaySheet>
	</div>

	<h2>{m.devUi_stickyPanel()}</h2>
	<StickyPanel label={title}>{@render sample()}</StickyPanel>
</section>

<style>
	section {
		display: grid;
		gap: var(--chip-gap);
	}

	.row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--gutter);
	}

	/* Stands in for the home screen the sheets rest on. */
	.frame {
		position: relative;
		height: var(--sheet-height);
	}
</style>
