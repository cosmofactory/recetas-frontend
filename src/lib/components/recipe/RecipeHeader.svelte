<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { components } from '#lib/api/schema.d.ts';
	import Photo from '#lib/components/Photo.svelte';
	import { DOT_SEPARATOR } from '#lib/i18n/format.ts';
	import { DISH_HERO_SIZES } from '#lib/media.ts';

	// strip: the Time / Serves strip, under the description in both layouts.
	type Props = {
		recipe: components['schemas']['Recipe'];
		mediaBaseUrl: string | undefined;
		strip: Snippet;
	};

	let { recipe, mediaBaseUrl, strip }: Props = $props();
</script>

<!-- The hero is above the fold, so it loads first; the <h1> names the page. -->
<header class="recipe-header">
	<div class="hero">
		<Photo
			photos={recipe.photos}
			role="hero"
			sizes={DISH_HERO_SIZES}
			alt=""
			baseUrl={mediaBaseUrl}
			priority
			height="var(--recipe-hero-height)"
			radius="var(--recipe-hero-radius)"
		/>
	</div>
	<div class="text">
		<span class="eyebrow" data-testid="recipe-eyebrow"
			>{recipe.regionName}{DOT_SEPARATOR}{recipe.dishName}</span
		>
		<h1 class="name">{recipe.name}</h1>
		<p class="description">{recipe.description}</p>
		{@render strip()}
	</div>
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
		--recipe-hero-radius: var(--radius-card);
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 4px 20px 0;
	}

	.text {
		display: flex;
		flex-direction: column;
		gap: 8px;
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

	/*
	 * Desktop README -> Recipe page: "Hero grid 1fr/1.1fr: eyebrow "Region ·
	 * Dish", title 56px serif, description 17px, Time / Serves strip | 380px
	 * photo"; the prototype: tracks minmax(0,1fr) minmax(0,1.1fr), align-items
	 * center, the text column's gap 14px, the eyebrow 11px, the title's lh 1,
	 * the description's lh 1.55 and the photo radius 22px.
	 */
	@media (min-width: 860px) {
		.recipe-header {
			--recipe-hero-height: 380px;
			--recipe-hero-radius: var(--radius-hero-desktop);
			display: grid;
			grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr);
			gap: var(--dish-header-gap-desktop);
			align-items: center;
			padding: 0;
		}

		.hero {
			grid-row: 1;
			grid-column: 2;
		}

		.text {
			gap: 14px;
		}

		.eyebrow {
			padding-top: 0;
			font-size: 11px;
		}

		.name {
			font-size: 56px;
			line-height: 1;
		}

		.description {
			font-size: 17px;
			line-height: 1.55;
		}
	}
</style>
