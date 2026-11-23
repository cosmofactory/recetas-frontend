<script lang="ts">
	import { onMount } from 'svelte';
	import type { components } from '#lib/api/schema.d.ts';
	import Chip from '#lib/components/ui/Chip.svelte';
	import ChipRow from '#lib/components/ui/ChipRow.svelte';
	import { revealInRow } from '#lib/ui/reveal-in-row.ts';
	import type { RegionClick } from './region-click.ts';

	// D-REG-1: the map regions' full-size twins, one chip link per region in
	// the order given (the map's). onActivate hears a chip's click before it
	// is followed, as RegionMap's does, so the screen treats both alike.
	type Props = {
		regions: Pick<components['schemas']['Region'], 'key' | 'name'>[];
		selectedKey?: string;
		hrefFor: (key: string) => string;
		onActivate?: (key: string, event: RegionClick) => void;
	};

	let { regions, selectedKey, hrefFor, onActivate }: Props = $props();

	// A deep link's region chip may start past the row's end: show it once.
	let row: HTMLDivElement | undefined = $state();
	onMount(() => {
		const current = row?.querySelector<HTMLElement>('[aria-current="true"]');
		if (row && current) revealInRow(row, current);
	});
</script>

<div data-testid="region-chips">
	<ChipRow bind:element={row}>
		{#each regions as region (region.key)}
			<Chip
				label={region.name}
				pressed={region.key === selectedKey}
				href={hrefFor(region.key)}
				onclick={(event) => onActivate?.(region.key, event)}
			/>
		{/each}
	</ChipRow>
</div>
