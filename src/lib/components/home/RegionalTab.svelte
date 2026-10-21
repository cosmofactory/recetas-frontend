<script lang="ts">
	import type { components } from '#lib/api/schema.d.ts';
	import { MediaQuery } from 'svelte/reactivity';
	import StickyPanel from '#lib/components/ui/StickyPanel.svelte';
	import RegionDetails from '#lib/content/RegionDetails.svelte';
	import RegionMap from '#lib/content/RegionMap.svelte';
	import { localizedHref, recipeHref as recipeHrefIn } from '#lib/i18n/localized-href.ts';
	import type { MapRegionData } from '#lib/map/region-map.ts';
	import { desktopQuery } from '#lib/ui/breakpoints.ts';
	import { sheetOpener } from '#lib/ui/sheet-opener.ts';
	import AboutBlock from './AboutBlock.svelte';
	import MetaRow from './MetaRow.svelte';
	import RegionSheet from './RegionSheet.svelte';
	import { DEFAULT_DESKTOP_REGION_KEY, findRegion, shownRegionKey } from './region-selection.ts';

	// selectedKey: the URL's region. onCloseRegion leaves it (the sheet's
	// scrim and Escape).
	type Props = {
		regions: MapRegionData[];
		dishes: components['schemas']['Dish'][];
		selectedKey: string | undefined;
		lang: string;
		mediaBaseUrl: string | undefined;
		onCloseRegion: () => void;
	};

	let { regions, dishes, selectedKey, lang, mediaBaseUrl, onCloseRegion }: Props = $props();

	// The server can't know the width: it renders the mobile selection, and
	// the desktop default appears on the map once hydrated.
	const desktop = new MediaQuery(desktopQuery, false);
	const selected = $derived(findRegion(regions, selectedKey));
	const panelRegion = $derived(findRegion(regions, shownRegionKey(selectedKey, true)));
	const mapKey = $derived(shownRegionKey(selectedKey, desktop.current));
	// Drawn selected by CSS alone from 860px, so the no-JS desktop map shows it.
	const defaultKey = $derived(selectedKey === undefined ? DEFAULT_DESKTOP_REGION_KEY : undefined);

	// The map link that opened the sheet gets focus back when it closes.
	const regionOpener = sheetOpener();

	const hrefFor = (regionKey: string) => localizedHref(`/regions/${regionKey}`, lang);
	const recipeHref = (dishKey: string, regionKey: string) => recipeHrefIn(dishKey, regionKey, lang);
</script>

<!--
	One map for both layouts: the same node moves between the mobile body and
	the desktop grid, so crossing 860px keeps its state.
-->
<div class="regional page-container">
	<div class="map-column">
		<MetaRow regionCount={regions.length} />
		<div class="map-frame">
			<!-- reset false: focus stays on the region link, so closing returns it there. -->
			<div class="map-box" data-sveltekit-reset="false">
				<RegionMap
					{regions}
					selectedKey={mapKey}
					{defaultKey}
					{hrefFor}
					onActivate={regionOpener.remember}
				/>
			</div>
		</div>
		<AboutBlock />
	</div>
	<div class="panel-column desktop-only">
		{#if panelRegion}
			<StickyPanel label={panelRegion.name} contentKey={panelRegion.key}>
				<RegionDetails region={panelRegion} {dishes} {recipeHref} {mediaBaseUrl} />
			</StickyPanel>
		{/if}
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
	 * max-height:100%; aspect-ratio:14/11": the frame is a size container, so
	 * the map's width follows the height left in it (a landscape phone).
	 */
	@media not all and (min-width: 860px) {
		.regional {
			display: flex;
			flex: 1;
			flex-direction: column;
			min-height: 0;
			padding: 14px 16px 16px;
		}

		.map-column {
			flex: 1;
			gap: 10px;
			min-height: 0;
		}

		.map-frame {
			container-type: size;
			display: flex;
			flex: 1;
			align-items: flex-start;
			justify-content: center;
			min-height: 0;
			padding-top: 6px;
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

		.map-frame {
			width: 100%;
			max-width: var(--map-max-width-desktop);
			margin-inline: auto;
		}
	}
</style>
