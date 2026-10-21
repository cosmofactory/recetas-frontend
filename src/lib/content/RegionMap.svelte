<script lang="ts">
	import { mapSize, shapedRegions, type MapRegionData } from '#lib/map/region-map.ts';
	import MapRegion from './MapRegion.svelte';

	// regions in API order; a region the API doesn't return isn't drawn.
	// defaultKey: drawn selected from 860px by CSS alone (the desktop default
	// without JavaScript); only selectedKey sets aria-current.
	type Props = {
		regions: MapRegionData[];
		selectedKey?: string;
		defaultKey?: string;
		hrefFor: (key: string) => string;
	};

	let { regions, selectedKey, defaultKey, hrefFor }: Props = $props();

	const drawn = $derived(shapedRegions(regions));
</script>

<!--
	The map is the region list (Accessibility: the region list for screen
	readers); role="list" because Safari drops list semantics with list-style: none.
-->
<ul
	class="region-map"
	role="list"
	data-testid="region-map"
	style:--map-columns={mapSize.columns}
	style:--map-rows={mapSize.rows}
>
	{#each drawn as region (region.key)}
		<li class="region-item">
			<MapRegion
				{region}
				href={hrefFor(region.key)}
				selected={region.key === selectedKey}
				isDefault={region.key === defaultKey}
			/>
		</li>
	{/each}
</ul>

<style>
	/*
	 * Mobile README -> Map (shared); desktop README -> Regional. The regions
	 * (MapRegion, one per list item) are stacked full-map layers in this box;
	 * sizing is the screen's.
	 */
	.region-map {
		position: relative;
		width: 100%;
		aspect-ratio: var(--map-columns) / var(--map-rows);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	/* Each item is a full-map layer too, so the regions stack as before. */
	.region-item {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}
</style>
