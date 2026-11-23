<script lang="ts">
	import type { components } from '#lib/api/schema.d.ts';
	import StickyPanel from '#lib/components/ui/StickyPanel.svelte';
	import RegionChooser from '#lib/content/RegionChooser.svelte';
	import RegionDetails from '#lib/content/RegionDetails.svelte';
	import type { MapRegionData } from '#lib/map/region-map.ts';
	import { m } from '#lib/paraglide/messages.js';

	// The desktop Regional right column: the selected region's details, or
	// with none selected the region chooser (D-FE9-8). `element`: the column,
	// for the screen's outside-click check.
	type Props = {
		region: MapRegionData | undefined;
		regions: MapRegionData[];
		dishes: components['schemas']['Dish'][];
		hrefFor: (regionKey: string) => string;
		recipeHref: (dishKey: string, regionKey: string) => string;
		mediaBaseUrl: string | undefined;
		element?: HTMLElement;
	};

	let {
		region,
		regions,
		dishes,
		hrefFor,
		recipeHref,
		mediaBaseUrl,
		element = $bindable()
	}: Props = $props();
</script>

<div class="panel-column desktop-only" bind:this={element}>
	<StickyPanel label={region?.name ?? m.desktop_clickRegion()} contentKey={region?.key}>
		{#if region}
			<RegionDetails {region} {dishes} {recipeHref} {mediaBaseUrl} />
		{:else}
			<RegionChooser {regions} {hrefFor} />
		{/if}
	</StickyPanel>
</div>
