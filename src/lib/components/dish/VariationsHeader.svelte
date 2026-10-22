<script lang="ts">
	import type { components } from '#lib/api/schema.d.ts';
	import Photo from '#lib/components/Photo.svelte';
	import { m } from '#lib/paraglide/messages.js';

	type Props = { dish: components['schemas']['Dish']; mediaBaseUrl: string | undefined };

	let { dish, mediaBaseUrl }: Props = $props();

	// Mobile: the page's width less its 20px side padding.
	const HERO_SIZES = 'calc(100vw - 40px)';
</script>

<!-- The hero is above the fold, so it loads first; the <h1> names the page. -->
<header class="variations-header">
	<Photo
		photos={dish.photos}
		role="hero"
		sizes={HERO_SIZES}
		alt=""
		baseUrl={mediaBaseUrl}
		priority
		height="var(--variations-hero-height)"
		radius="var(--radius-card)"
	/>
	<div class="title-row">
		<h1 class="name">{dish.name}</h1>
		<span class="count">{m.home_variation({ count: dish.variations.length })}</span>
	</div>
	<p class="description">{dish.description}</p>
</header>

<style>
	/*
	 * Mobile README -> Screen 2 "Header (padding 4px 20px 0, gap 10px): hero
	 * photo (height 180px, radius 16px); row with dish name (Instrument Serif
	 * 34px, lh 1.02) + "N variations" (12px/700 accent); description (13px
	 * ink-2, lh 1.5)"; the prototype gives the row's baseline, gap,
	 * padding-top and the count's nowrap (tokens.json: the hero is
	 * --radius-card).
	 */
	.variations-header {
		--variations-hero-height: 180px;
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 4px 20px 0;
	}

	.title-row {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 10px;
		padding-top: 6px;
	}

	.name {
		margin: 0;
		font: 400 34px / 1.02 var(--font-display);
	}

	.count {
		color: var(--accent-text);
		font-size: 12px;
		font-weight: 700;
		white-space: nowrap;
	}

	.description {
		margin: 0;
		color: var(--ink-2);
		font-size: 13px;
		line-height: 1.5;
		text-wrap: pretty;
	}
</style>
