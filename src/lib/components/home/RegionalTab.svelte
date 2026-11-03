<script lang="ts">
	import type { components } from '#lib/api/schema.d.ts';
	import { MediaQuery } from 'svelte/reactivity';
	import StickyPanel from '#lib/components/ui/StickyPanel.svelte';
	import RegionChooser from '#lib/content/RegionChooser.svelte';
	import RegionDetails from '#lib/content/RegionDetails.svelte';
	import RegionMap from '#lib/content/RegionMap.svelte';
	import type { RegionClick } from '#lib/content/region-click.ts';
	import { recipeHref as recipeHrefIn, regionHref } from '#lib/i18n/localized-href.ts';
	import type { MapRegionData } from '#lib/map/region-map.ts';
	import { m } from '#lib/paraglide/messages.js';
	import { desktopQuery } from '#lib/ui/breakpoints.ts';
	import { sheetOpener } from '#lib/ui/sheet-opener.ts';
	import AboutBlock from './AboutBlock.svelte';
	import MetaRow from './MetaRow.svelte';
	import RegionSheet from './RegionSheet.svelte';
	import { desktopRegionClear } from './desktop-region-clear.svelte.ts';
	import { findRegion } from './region-selection.ts';

	// selectedKey: the URL's region. onCloseRegion leaves it (the sheet's
	// scrim and Escape; on desktop a click on it again and Escape).
	type Props = {
		regions: MapRegionData[];
		dishes: components['schemas']['Dish'][];
		selectedKey: string | undefined;
		lang: string;
		mediaBaseUrl: string | undefined;
		onCloseRegion: () => void;
	};

	let { regions, dishes, selectedKey, lang, mediaBaseUrl, onCloseRegion }: Props = $props();

	// The server can't know the width; both layouts select only the URL's region.
	const desktop = new MediaQuery(desktopQuery, false);
	const selected = $derived(findRegion(regions, selectedKey));

	// The map link that opened the sheet gets focus back when it closes.
	const regionOpener = sheetOpener();
	let mapBox: HTMLElement | undefined = $state();
	let panelColumn: HTMLElement | undefined = $state();
	const clearSelected = desktopRegionClear({
		selectedKey: () => (desktop.current ? selected?.key : undefined),
		onClear: () => onCloseRegion(),
		panel: () => panelColumn,
		regionLink: (key) =>
			mapBox?.querySelector<HTMLElement>(`a[href="${hrefFor(key)}"]`) ?? undefined
	});

	function activateRegion(key: string, event: RegionClick) {
		if (clearSelected(key, event)) return;
		regionOpener.remember(key, event.currentTarget);
	}

	const hrefFor = (regionKey: string) => regionHref(regionKey, lang);
	const recipeHref = (dishKey: string, regionKey: string) => recipeHrefIn(dishKey, regionKey, lang);
</script>

<!--
	One map for both layouts: the same node moves between the mobile body and
	the desktop grid, so crossing 860px keeps its state.
-->
<div class="regional page-container">
	<div class="map-column">
		<MetaRow regionCount={regions.length} />
		<div class="map-scroller">
			<div class="map-frame">
				<!-- reset false: focus stays on the region link, so closing returns it there. -->
				<div class="map-box" data-sveltekit-reset="false" bind:this={mapBox}>
					<RegionMap {regions} selectedKey={selected?.key} {hrefFor} onActivate={activateRegion} />
				</div>
			</div>
			<AboutBlock />
		</div>
	</div>
	<div class="panel-column desktop-only" bind:this={panelColumn}>
		<StickyPanel label={selected?.name ?? m.desktop_clickRegion()} contentKey={selected?.key}>
			{#if selected}
				<RegionDetails region={selected} {dishes} {recipeHref} {mediaBaseUrl} />
			{:else}
				<RegionChooser {regions} {hrefFor} />
			{/if}
		</StickyPanel>
	</div>
</div>
<RegionSheet
	region={selected}
	active={!desktop.current}
	onClose={onCloseRegion}
	opener={() => regionOpener.forKey(selected?.key)}
	{dishes}
	{recipeHref}
	{mediaBaseUrl}
/>

<style>
	/*
	 * The width keeps the .page-container cap working in the frame's flex
	 * column (auto side margins would shrink it to its content).
	 */
	.regional {
		width: 100%;
	}

	.map-column {
		display: flex;
		flex-direction: column;
	}

	/*
	 * Mobile README -> Regional tab: "body (flex:1, padding 14px 16px 16px,
	 * column, gap 10px)". The prototype's map wrapper is "flex:1; min-height:0;
	 * justify-content:center; padding-top:6px" and the map "width:100%;
	 * max-height:100%; aspect-ratio:14/11". Under the meta row the map and the
	 * about block (D-FE9-4, "reached by scrolling") scroll inside the frame;
	 * the scroller is a size container, so the map's width follows the height
	 * it shows (a landscape phone) and the about block sits right below it.
	 */
	@media not all and (min-width: 860px) {
		.regional {
			display: flex;
			flex: 1;
			flex-direction: column;
			min-height: 0;
			padding: 14px 16px 0;
		}

		.map-column {
			flex: 1;
			gap: 10px;
			min-height: 0;
		}

		.map-scroller {
			container-type: size;
			flex: 1;
			min-height: 0;
			padding: 6px 0 16px;
			overflow-y: auto;
		}

		.map-frame {
			display: flex;
			justify-content: center;
		}

		.map-box {
			width: var(--map-max-width-mobile);
		}
	}

	/*
	 * Desktop README -> Regional: "grid minmax(0,1.4fr) minmax(320px,1fr)";
	 * the prototype pads it "28px clamp(24px,2.8vw,40px) 36px" (the sides are
	 * .page-container's) and stacks the left column with "gap:14px". The map
	 * is centred in its column, up to its cap.
	 */
	@media (min-width: 860px) {
		.regional {
			display: grid;
			grid-template-columns: minmax(0, 1.4fr) minmax(320px, 1fr);
			gap: var(--desktop-gap);
			padding-block: 28px 36px;
		}

		.map-column {
			gap: 14px;
		}

		.map-scroller {
			display: contents;
		}

		.map-frame {
			width: 100%;
			max-width: var(--map-max-width-desktop);
			margin-inline: auto;
		}
	}
</style>
