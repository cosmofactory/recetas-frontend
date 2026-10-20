<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import RegionMap from '#lib/content/RegionMap.svelte';
	import AboutBlock from './AboutBlock.svelte';
	import MetaRow from './MetaRow.svelte';

	type Props = ComponentProps<typeof RegionMap>;

	let { regions, selectedKey, hrefFor }: Props = $props();
</script>

<!--
	One map for both layouts: the same node moves between the mobile body and
	the desktop grid, so crossing 860px keeps its state.
-->
<div class="regional page-container">
	<div class="map-column">
		<MetaRow regionCount={regions.length} />
		<div class="map-frame">
			<div class="map-box">
				<RegionMap {regions} {selectedKey} {hrefFor} />
			</div>
		</div>
		<AboutBlock />
	</div>
	<!-- The region panel (StickyPanel) arrives with FE-4 PR 3. -->
	<div class="panel-column desktop-only"></div>
</div>

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
