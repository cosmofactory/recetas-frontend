<script lang="ts">
	import type { components } from '#lib/api/schema.d.ts';
	import Photo from '#lib/components/Photo.svelte';
	import { MOBILE_CONTENT_WIDTH_SIZES } from '#lib/media.ts';
	import { m } from '#lib/paraglide/messages.js';

	type Props = {
		variation: components['schemas']['VariationSummary'];
		href: string;
		mediaBaseUrl: string | undefined;
	};

	let { variation, href, mediaBaseUrl }: Props = $props();
</script>

<!-- The whole card is one link to its recipe; the photo is decorative. -->
<a class="variation-card" data-testid="variation-card" {href}>
	<Photo
		photos={variation.photos}
		role="card"
		sizes={MOBILE_CONTENT_WIDTH_SIZES}
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
</style>
