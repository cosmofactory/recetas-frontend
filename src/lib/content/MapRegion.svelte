<script lang="ts">
	import type { ShapedRegion } from '#lib/map/region-map.ts';

	// isDefault: the desktop default region, drawn selected from 860px by
	// CSS alone (a server-rendered page doesn't know its width).
	type Props = {
		region: ShapedRegion;
		href: string;
		selected: boolean;
		isDefault?: boolean;
		onclick?: (event: MouseEvent & { currentTarget: HTMLAnchorElement }) => void;
	};

	let { region, href, selected, isDefault = false, onclick }: Props = $props();

	const isPlainSpace = (event: KeyboardEvent) =>
		event.key === ' ' && !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey;

	// A link activates on Enter natively; the map's regions act like buttons
	// too, on a first plain Space press (a held key still doesn't scroll).
	function activateOnSpace(event: KeyboardEvent & { currentTarget: HTMLAnchorElement }) {
		if (!isPlainSpace(event)) return;
		event.preventDefault();
		if (!event.repeat) event.currentTarget.click();
	}
</script>

<a
	class="map-region"
	{href}
	aria-current={selected ? 'true' : undefined}
	data-default={isDefault ? '' : undefined}
	class:untinted={region.tileColor === null}
	style:--tile-color={region.tileColor ?? undefined}
	onkeydown={activateOnSpace}
	{onclick}
>
	{#each region.shape.cells as cell (`${cell.row}/${cell.col}`)}
		<span
			class="cell"
			data-map-cell
			aria-hidden="true"
			style:grid-row={cell.row}
			style:grid-column={cell.col}
		></span>
	{/each}
	{#if region.shape.bottomEdge}
		{@const edge = region.shape.bottomEdge}
		<span
			class="hit-extension"
			aria-hidden="true"
			style:grid-row={edge.row}
			style:grid-column="{edge.columnStart} / {edge.columnEnd}"
		></span>
	{/if}
	<span
		class="map-label"
		data-map-label
		style:left={region.shape.label.left}
		style:top={region.shape.label.top}>{region.mapLabel}</span
	>{#if region.name !== region.mapLabel}<span class="visually-hidden"> {region.name}</span>{/if}
</a>

<style>
	/*
	 * One region of RegionMap (inside its list item): a full-map grid layer that only its cells make
	 * hittable, so the whole region is one target. Its focus ring is on the
	 * label (layout.css).
	 */
	.map-region {
		position: absolute;
		inset: 0;
		display: grid;
		grid-template-columns: repeat(var(--map-columns), 1fr);
		grid-template-rows: repeat(var(--map-rows), 1fr);
		gap: var(--map-gap);
		color: var(--ink);
		text-decoration: none;
		pointer-events: none;
	}

	.cell {
		border-radius: var(--radius-map-cell);
		background-color: var(--tile-color);
		cursor: pointer;
		pointer-events: auto;
		transition:
			background-color var(--dur-colour),
			filter var(--dur-colour);
	}

	/*
	 * Accessibility (44px targets, FE-8): Canarias is one row tall (about
	 * 23px on a phone), so a region on the map's bottom row grows its target
	 * invisibly below the map, where no other region is, to --hit-min from
	 * the row's top. Positioned in the row's grid area, so 100% is the row.
	 */
	.hit-extension {
		position: absolute;
		top: 100%;
		right: 0;
		left: 0;
		height: max(0px, calc(var(--hit-min) - 100%));
		cursor: pointer;
		pointer-events: auto;
	}

	/* A colour the server rejected (region-colour.ts) draws as the placeholder. */
	.untinted .cell {
		background-image: var(--placeholder);
	}

	.map-region[aria-current='true'] .cell {
		background-color: var(--region-selected);
		background-image: none;
	}

	/* Above every region's cells; clicks fall through to the cell below. */
	.map-label {
		position: absolute;
		z-index: 1;
		transform: translate(-50%, -50%);
		padding: var(--map-label-padding);
		border-radius: var(--radius-map-label);
		background-color: var(--map-label-bg);
		font-size: var(--map-label-size);
		font-weight: 700;
		white-space: nowrap;
		pointer-events: none;
	}

	@media (hover: hover) {
		.map-region:hover .cell {
			filter: var(--map-hover-filter);
		}
	}

	@media (min-width: 860px) {
		.map-region {
			gap: var(--map-gap-desktop);
		}

		.cell {
			border-radius: var(--radius-map-cell-desktop);
			transition:
				background-color var(--dur-colour),
				filter var(--dur-map-hover);
		}

		.map-label {
			padding: var(--map-label-padding-desktop);
			border-radius: var(--radius-map-label-desktop);
			background-color: var(--map-label-bg-desktop);
			font-size: var(--map-label-size-desktop);
			transition:
				background-color var(--dur-map-hover),
				color var(--dur-map-hover);
		}

		.map-region[data-default] .cell {
			background-color: var(--region-selected);
			background-image: none;
		}

		.map-region:is([aria-current='true'], [data-default]) .map-label {
			background-color: var(--ink);
			color: var(--on-accent);
			box-shadow: var(--shadow-map-label);
		}

		@media (hover: hover) {
			.map-region:hover .cell {
				filter: var(--map-hover-filter-desktop);
			}

			.map-region:is([aria-current='true'], [data-default]):hover .cell {
				filter: none;
			}

			.map-region:not([aria-current='true'], [data-default]):hover .map-label {
				background-color: var(--bg-surface);
				box-shadow: var(--shadow-map-label);
			}
		}
	}
</style>
