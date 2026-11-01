<script lang="ts">
	import { mapSize, shapedRegions, type MapRegionData } from '#lib/map/region-map.ts';
	import MapRegion from './MapRegion.svelte';

	// regions in API order; a region the API doesn't return isn't drawn.
	// defaultKey: drawn selected from 860px by CSS alone (the desktop default
	// without JavaScript); only selectedKey sets aria-current. onActivate
	// reports the region link a click (or Enter/Space) followed.
	type Props = {
		regions: MapRegionData[];
		selectedKey?: string;
		defaultKey?: string;
		hrefFor: (key: string) => string;
		onActivate?: (key: string, link: HTMLElement) => void;
	};

	let { regions, selectedKey, defaultKey, hrefFor, onActivate }: Props = $props();

	const drawn = $derived(shapedRegions(regions));
	const isDrawn = (key: string | undefined) => drawn.some((region) => region.key === key);
</script>

<!--
	The map is the region list (Accessibility: the region list for screen
	readers); role="list" because Safari drops list semantics with list-style: none.
-->
<ul
	class="region-map"
	role="list"
	data-testid="region-map"
	data-has-selected={isDrawn(selectedKey) ? '' : undefined}
	data-has-default={isDrawn(defaultKey) ? '' : undefined}
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
				onclick={(event) => onActivate?.(region.key, event.currentTarget)}
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

	/*
	 * D-FE9-3: while a region is selected, every other region's cells (never
	 * the labels) are dimmed. The desktop default counts from 860px, from the
	 * server HTML alone. Forced colours mark the selection with Highlight
	 * instead (layout.css), so nothing dims there.
	 */
	@media (forced-colors: none) {
		.region-map[data-has-selected] :global(.map-region:not([aria-current='true']) .cell) {
			opacity: var(--region-dimmed-opacity);
		}
	}

	@media (min-width: 860px) and (forced-colors: none) {
		.region-map:is([data-has-selected], [data-has-default])
			:global(.map-region:not([aria-current='true'], [data-default]) .cell) {
			opacity: var(--region-dimmed-opacity);
		}
	}
</style>
