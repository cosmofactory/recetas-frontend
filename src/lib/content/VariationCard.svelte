<script lang="ts">
	import type { components } from '#lib/api/schema.d.ts';
	import Photo from '#lib/components/Photo.svelte';
	import { VARIATION_CARD_SIZES } from '#lib/media.ts';
	import { m } from '#lib/paraglide/messages.js';

	type Props = {
		variation: components['schemas']['VariationSummary'];
		href: string;
		mediaBaseUrl: string | undefined;
	};

	let { variation, href, mediaBaseUrl }: Props = $props();
</script>

<!-- The whole card is one link to its recipe; the photo is decorative. -->
<a class="variation-card hover-lift" data-testid="variation-card" {href}>
	<Photo
		photos={variation.photos}
		role="card"
		sizes={VARIATION_CARD_SIZES}
		alt=""
		baseUrl={mediaBaseUrl}
		height="var(--variation-photo-height)"
		radius="0"
	/>
	<div class="body">
		<span class="region">{variation.regionName}</span>
		<h2 class="name">{variation.name}</h2>
		<span class="description">{variation.description}</span>
		<span class="view-recipe">{m.variationsPage_viewRecipe()}</span>
	</div>
</a>

<style>
	/*
	 * Mobile README -> Screen 2 "Variation cards": "bg --bg-surface, 1.5px
	 * border --border-card, radius 18px, overflow hidden. Photo, height 130px
	 * (full bleed in the card). Body (padding 13px 15px 15px, gap 5px)"; the
	 * prototype adds the "View recipe →" padding-top 4px. Its .62 description
	 * misses AA, so it is --ink-2 (X10).
	 */
	.variation-card {
		--variation-photo-height: 130px;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		border: 1.5px solid var(--border-card);
		border-radius: var(--radius-variation-card);
		background: var(--bg-surface);
		color: var(--ink);
		text-decoration: none;
	}

	.body {
		display: flex;
		flex-direction: column;
		gap: 5px;
		padding: 13px 15px 15px;
	}

	.region {
		color: var(--accent-text);
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.11em;
		text-transform: uppercase;
	}

	.name {
		margin: 0;
		font: 400 22px / 1.1 var(--font-display);
	}

	.description {
		color: var(--ink-2);
		font-size: 12.5px;
		line-height: 1.45;
	}

	.view-recipe {
		padding-top: 4px;
		color: var(--accent-text);
		font-size: 12.5px;
		font-weight: 600;
	}

	/*
	 * Desktop README -> Variations page: "190px photo, region eyebrow, 25px
	 * serif name, description, "View recipe →""; the prototype: 1px
	 * --border-card, radius 20px, body "padding:18px 20px 20px; gap:6px",
	 * eyebrow 10.5px, description 14px, "View recipe" 13px with padding-top
	 * 6px, and the shared hover lift.
	 */
	@media (min-width: 860px) {
		.variation-card {
			--variation-photo-height: 190px;
			border-width: 1px;
			border-radius: var(--radius-variation-card-desktop);
		}

		.body {
			gap: 6px;
			padding: 18px 20px 20px;
		}

		.region {
			font-size: 10.5px;
		}

		.name {
			font-size: 25px;
		}

		.description {
			font-size: 14px;
		}

		.view-recipe {
			padding-top: 6px;
			font-size: 13px;
		}
	}
</style>
