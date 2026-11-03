<script lang="ts">
	import { mapSize, shapedRegions, type MapRegionData } from '#lib/map/region-map.ts';
	import MapRegion from './MapRegion.svelte';
	import type { RegionClick } from './region-click.ts';

	// regions in API order; a region the API doesn't return isn't drawn.
	// onActivate hears a click (or Enter/Space) on a region link before it is
	// followed, so the screen may take it over.
	type Props = {
		regions: MapRegionData[];
		selectedKey?: string;
		hrefFor: (key: string) => string;
		onActivate?: (key: string, event: RegionClick) => void;
	};

	let { regions, selectedKey, hrefFor, onActivate }: Props = $props();

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
	style:--map-columns={mapSize.columns}
	style:--map-rows={mapSize.rows}
>
	{#each drawn as region (region.key)}
		<li class="region-item">
			<MapRegion
				{region}
				href={hrefFor(region.key)}
				selected={region.key === selectedKey}
				onclick={(event) => onActivate?.(region.key, event)}
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
	 * the labels) are dimmed. Forced colours mark the selection with
	 * Highlight instead (layout.css), so nothing dims there.
	 */
	@media (forced-colors: none) {
		.region-map[data-has-selected] :global(.map-region:not([aria-current='true']) .cell) {
			opacity: var(--region-dimmed-opacity);
		}
	}
</style>
