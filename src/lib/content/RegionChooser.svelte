<script lang="ts">
	import type { components } from '#lib/api/schema.d.ts';
	import { typeset } from '#lib/i18n/typeset.ts';
	import { m } from '#lib/paraglide/messages.js';

	// The desktop region panel with no region (D-FE9-8): the map's hint as a
	// title, then every region, in map order, as a link to its page.
	type Props = {
		regions: Pick<components['schemas']['Region'], 'key' | 'name'>[];
		hrefFor: (key: string) => string;
	};

	let { regions, hrefFor }: Props = $props();
</script>

<div class="region-chooser" data-testid="region-panel-empty">
	<h2 class="title">{typeset(m.desktop_clickRegion())}</h2>
	<ul class="chips" role="list">
		{#each regions as region (region.key)}
			<li><a class="chip" href={hrefFor(region.key)}>{typeset(region.name)}</a></li>
		{/each}
	</ul>
</div>

<style>
	/*
	 * Desktop README -> Regional (D-FE9-8): "the 'Click a region to explore'
	 * hint as a serif title followed by the 14 regions as chips". The title
	 * takes the region name's size; the chips are the panel's regional dish
	 * chips (RegionDetails, desktop), as links. Centred in the panel, an
	 * empty state, which also keeps the links clear of the search dropdown
	 * and the language menu that open over the panel's top.
	 */
	.region-chooser {
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 16px;
		min-height: 100%;
	}

	.title {
		margin: 0;
		font: 400 46px var(--font-display);
		line-height: 1.02;
	}

	/*
	 * Links, so unlike Chip in a wrapping ChipRow (the FE-3 exception) each
	 * one needs a full 44px target: every row is --hit-min tall with its
	 * chips centred, so the targets meet without overlapping.
	 */
	.chips {
		display: flex;
		flex-wrap: wrap;
		column-gap: 8px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.chips li {
		display: flex;
		align-items: center;
		min-height: var(--hit-min);
	}

	.chip {
		position: relative;
		padding: 7px 13px;
		border: 1px solid var(--border-field);
		border-radius: var(--radius-pill);
		color: var(--ink);
		font-size: 12.5px;
		font-weight: 500;
		text-decoration: none;
		transition: background-color var(--dur-colour);
	}

	.chip::before {
		content: '';
		position: absolute;
		inset: var(--hit-inset);
	}

	@media (hover: hover) {
		.chip:hover {
			background-color: var(--bg-surface-muted);
		}
	}
</style>
