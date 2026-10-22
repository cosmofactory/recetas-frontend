<script lang="ts">
	import type { components } from '#lib/api/schema.d.ts';
	import Photo from '#lib/components/Photo.svelte';
	import { DOT_SEPARATOR } from '#lib/i18n/format.ts';
	import { MOBILE_CONTENT_WIDTH_SIZES } from '#lib/media.ts';

	type Props = { recipe: components['schemas']['Recipe']; mediaBaseUrl: string | undefined };

	let { recipe, mediaBaseUrl }: Props = $props();
</script>

<!-- The hero is above the fold, so it loads first; the <h1> names the page. -->
<header class="recipe-header">
	<Photo
		photos={recipe.photos}
		role="hero"
		sizes={MOBILE_CONTENT_WIDTH_SIZES}
		alt=""
		baseUrl={mediaBaseUrl}
		priority
		height="var(--recipe-hero-height)"
		radius="var(--radius-card)"
	/>
	<span class="eyebrow" data-testid="recipe-eyebrow"
		>{recipe.regionName}{DOT_SEPARATOR}{recipe.dishName}</span
	>
	<h1 class="name">{recipe.name}</h1>
	<p class="description">{recipe.description}</p>
</header>

<style>
	/*
	 * Mobile README -> Screen 3: "Hero photo (height 220px, radius 16px).
	 * Eyebrow (10.5px/700, .11em, accent, padding-top 8px). Variation name
	 * (Instrument Serif 34px) and description (13px ink-2)"; the prototype
	 * gives the padding 4px 20px 0, gap 8px, the name's lh 1.02 and the
	 * description's lh 1.5. Accent text is --accent-text (X10).
	 */
	.recipe-header {
		--recipe-hero-height: 220px;
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 4px 20px 0;
	}

	.eyebrow {
		padding-top: 8px;
		color: var(--accent-text);
		font-size: 10.5px;
		font-weight: 700;
		letter-spacing: 0.11em;
		text-transform: uppercase;
	}

	.name {
		margin: 0;
		font: 400 34px / 1.02 var(--font-display);
	}

	.description {
		margin: 0;
		color: var(--ink-2);
		font-size: 13px;
		line-height: 1.5;
		text-wrap: pretty;
	}
</style>
