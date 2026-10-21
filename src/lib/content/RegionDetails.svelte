<script lang="ts">
	import type { components } from '#lib/api/schema.d.ts';
	import { m } from '#lib/paraglide/messages.js';
	import RegionDishRow from './RegionDishRow.svelte';
	import { regionVariations } from './region-variations.ts';

	type Schemas = components['schemas'];

	// The region sheet (mobile) and region panel (desktop) content; the
	// screen picks the container. recipeHref(dishKey, regionKey) is a row's link.
	type Props = {
		region: Pick<Schemas['Region'], 'key' | 'name' | 'description' | 'regionalDishes'>;
		dishes: Schemas['Dish'][];
		recipeHref: (dishKey: string, regionKey: string) => string;
		mediaBaseUrl: string | undefined;
	};

	let { region, dishes, recipeHref, mediaBaseUrl }: Props = $props();

	const rows = $derived(regionVariations(region.key, dishes));
</script>

<div class="region-details" data-testid="region-details">
	<div class="title-row">
		<h2 class="name">{region.name}</h2>
		<span class="count">{m.home_variation({ count: rows.length })}</span>
	</div>
	<p class="description">{region.description}</p>
	<!-- Labels, not filters: the prototype gives the chips no action. -->
	<ul class="chips" role="list">
		{#each region.regionalDishes as dish, i (i)}
			<li class="chip">{dish}</li>
		{/each}
	</ul>
	<ul class="rows" role="list">
		{#each rows as row (row.dishKey)}
			<li><RegionDishRow {row} href={recipeHref(row.dishKey, region.key)} {mediaBaseUrl} /></li>
		{/each}
	</ul>
</div>

<style>
	/*
	 * Mobile README -> Region sheet: "Content (padding 4px 22px 22px, column,
	 * gap 14px): Title row: region name, Instrument Serif 34px. Description:
	 * 12.5px, ink-2, line-height 1.45, margin-top −8px. Regional dish chips:
	 * wrap, gap 8px; each padding 7px 12px, 1px --border-field, pill,
	 * 12px/500. Divider (1px rgba(43,30,22,.12)), then a dish list"; the
	 * prototype gives the title row's baseline alignment, the count and the
	 * list's padding-top.
	 */
	.region-details {
		display: flex;
		flex-direction: column;
		gap: 14px;
		padding: 4px 22px 22px;
	}

	.title-row {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
	}

	.name {
		margin: 0;
		font: 400 34px var(--font-display);
	}

	.count {
		color: var(--accent-text);
		font-size: 12px;
		font-weight: 600;
	}

	.description {
		margin: -8px 0 0;
		color: var(--ink-2);
		font-size: 12.5px;
		line-height: 1.45;
	}

	.chips,
	.rows {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.chip {
		padding: 7px 12px;
		border: 1px solid var(--border-field);
		border-radius: var(--radius-pill);
		font-size: 12px;
		font-weight: 500;
	}

	.rows {
		display: flex;
		flex-direction: column;
		padding-top: 6px;
		border-top: 1px solid var(--border-about);
	}

	/* Desktop README -> Regional: region panel; the panel pads (StickyPanel), the prototype gives the rest. */
	@media (min-width: 860px) {
		.region-details {
			gap: 16px;
			padding: 0;
		}

		.title-row {
			gap: 16px;
		}

		.name {
			font-size: 46px;
			line-height: 1.02;
		}

		.count {
			font-size: 13px;
			font-weight: 700;
			white-space: nowrap;
		}

		.description {
			margin: 0;
			font-size: 15px;
			line-height: 1.55;
			text-wrap: pretty;
		}

		.chip {
			padding: 7px 13px;
			font-size: 12.5px;
		}

		.rows {
			padding-top: 8px;
		}
	}
</style>
