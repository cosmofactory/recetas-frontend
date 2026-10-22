<script lang="ts">
	import type { components } from '#lib/api/schema.d.ts';
	import Photo from '#lib/components/Photo.svelte';
	import { DISH_HERO_SIZES } from '#lib/media.ts';
	import { m } from '#lib/paraglide/messages.js';

	type Props = { dish: components['schemas']['Dish']; mediaBaseUrl: string | undefined };

	let { dish, mediaBaseUrl }: Props = $props();
</script>

<!-- The hero is above the fold, so it loads first; the <h1> names the page. -->
<header class="variations-header">
	<div class="hero">
		<Photo
			photos={dish.photos}
			role="hero"
			sizes={DISH_HERO_SIZES}
			alt=""
			baseUrl={mediaBaseUrl}
			priority
			height="var(--variations-hero-height)"
			radius="var(--variations-hero-radius)"
		/>
	</div>
	<div class="text">
		<div class="title-row">
			<h1 class="name">{dish.name}</h1>
			<span class="count">{m.home_variation({ count: dish.variations.length })}</span>
		</div>
		<p class="description">{dish.description}</p>
	</div>
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
		--variations-hero-radius: var(--radius-card);
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 4px 20px 0;
	}

	.text {
		display: flex;
		flex-direction: column;
		gap: 10px;
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

	/*
	 * Desktop README -> Variations page: "header grid 1fr/1fr: count, title
	 * (serif 64px, lh .98), description 17px | 320px hero photo"; the
	 * prototype: tracks minmax(0,1fr) twice, align-items end, the text column
	 * "gap:16px; padding-bottom:8px" with the count (13px/700) first, the
	 * description lh 1.55 and max-width 520px, the hero radius 22px.
	 */
	@media (min-width: 860px) {
		.variations-header {
			--variations-hero-height: 320px;
			--variations-hero-radius: var(--radius-hero-desktop);
			display: grid;
			grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
			gap: var(--dish-header-gap-desktop);
			align-items: end;
			padding: 0;
		}

		.hero {
			grid-row: 1;
			grid-column: 2;
		}

		.text {
			gap: 16px;
			padding-bottom: 8px;
		}

		.title-row {
			flex-direction: column-reverse;
			align-items: flex-start;
			gap: 16px;
			padding-top: 0;
		}

		.name {
			font-size: 64px;
			line-height: 0.98;
		}

		.count {
			font-size: 13px;
		}

		.description {
			max-width: 520px;
			font-size: 17px;
			line-height: 1.55;
		}
	}
</style>
