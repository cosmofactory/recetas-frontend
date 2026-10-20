<script lang="ts">
	import Chip from '#lib/components/ui/Chip.svelte';
	import ChipRow from '#lib/components/ui/ChipRow.svelte';

	// Test harness (FE-3): a ChipRow of real Chips, so the row's scrolling and
	// the chips' hit areas are tested together, as a screen composes them.
	type Props = { labels: string[]; wrap?: boolean };

	let { labels, wrap = false }: Props = $props();
</script>

<ChipRow {wrap}>
	{#each labels as label (label)}
		<Chip {label} pressed={false} onToggle={() => {}} />
	{/each}
</ChipRow>
