<script lang="ts">
	import type { components } from '#lib/api/schema.d.ts';
	import Photo from '#lib/components/Photo.svelte';

	type Props = {
		variation: components['schemas']['VariationSummary'];
		href: string;
		mediaBaseUrl: string | undefined;
	};

	let { variation, href, mediaBaseUrl }: Props = $props();

	// Mobile README -> Dish detail sheet: a 42px thumb.
	const THUMB_SIZES = '42px';
</script>

<!-- The whole row is one link; the photo is decorative, the name names it. -->
<a class="row" {href}>
	<span class="thumb">
		<Photo
			photos={variation.photos}
			role="thumb"
			sizes={THUMB_SIZES}
			alt=""
			baseUrl={mediaBaseUrl}
		/>
	</span>
	<span class="text">
		<span class="name-line">
			<span class="name">{variation.name}</span>
			<span class="region">{variation.regionName}</span>
		</span>
		<span class="description">{variation.description}</span>
	</span>
</a>

<style>
	/*
	 * Mobile README -> Dish detail sheet: "Row: padding 10px 8px, hairline
	 * bottom border, radius 8px, gap 10px: 42px thumb (radius 8px); column
	 * with name (13.5px/600) + region (10.5px, ink-4) on one baseline row,
	 * and the description below (11px ink-2)"; the prototype gives the
	 * centring, the column's gap 2px, the name row's gap 7px and the
	 * description's line-height. ink-4 misses AA, so the region is --ink-3
	 * (X10). No highlighted row, so no hover either (the prototype has none).
	 */
	.row {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 8px;
		border-bottom: 1px solid var(--border-hairline);
		border-radius: var(--radius-dish-row);
		color: var(--ink);
		text-decoration: none;
	}

	.thumb {
		flex: none;
		width: 42px;
		height: 42px;
		overflow: hidden;
		border-radius: var(--radius-dish-thumb);
	}

	.text {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.name-line {
		display: flex;
		align-items: baseline;
		gap: 7px;
	}

	.name {
		font-size: 13.5px;
		font-weight: 600;
	}

	.region {
		color: var(--ink-3);
		font-size: 10.5px;
	}

	.description {
		color: var(--ink-2);
		font-size: 11px;
		line-height: 1.35;
	}
</style>
