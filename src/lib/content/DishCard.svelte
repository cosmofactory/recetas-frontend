<script lang="ts">
	import type { components } from '#lib/api/schema.d.ts';
	import Photo from '#lib/components/Photo.svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { desktopQuery } from '#lib/ui/breakpoints.ts';
	import { dishPreview } from './dish-preview.ts';

	type Props = {
		dish: components['schemas']['Dish'];
		href: string;
		mediaBaseUrl: string | undefined;
	};

	let { dish, href, mediaBaseUrl }: Props = $props();

	// Mobile: the list's full width. Desktop: a grid column of at least 250px
	// (desktop README -> Popular); PR 3 refines it with the desktop grid.
	const PHOTO_SIZES = `${desktopQuery} 400px, 100vw`;
	const PHOTO_HEIGHT = '96px';
</script>

<!-- The whole card is one link; the photo is decorative, the name names it. -->
<a class="dish-card" data-testid="dish-card" {href}>
	<Photo
		photos={dish.photos}
		role="card"
		sizes={PHOTO_SIZES}
		alt=""
		baseUrl={mediaBaseUrl}
		height={PHOTO_HEIGHT}
		radius="var(--radius-card-photo)"
	/>
	<div class="name-row">
		<h3 class="name">{dish.name}</h3>
		<span class="count">{m.home_variation({ count: dish.variations.length })}</span>
	</div>
	<p class="description">{dish.description}</p>
	<p class="preview">{dishPreview(dish)}</p>
</a>

<style>
	/*
	 * Mobile README -> Popular tab: "Card: bg --bg-surface, 1px --border-card,
	 * radius 16px, padding 14px 15px, column gap 7px. Hover bg ..." (--bg-card-hover). The
	 * prototype adds the name's line-height 1.1, the row gap 10px, the
	 * count's nowrap and the preview's line-height 1.35 and hairline.
	 */
	.dish-card {
		display: flex;
		flex-direction: column;
		gap: 7px;
		padding: 14px 15px;
		border: 1px solid var(--border-card);
		border-radius: var(--radius-card);
		background: var(--bg-surface);
		color: var(--ink);
		text-decoration: none;
		transition: background-color var(--dur-colour);
	}

	.name-row {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 10px;
	}

	.name {
		margin: 0;
		font: 400 21px / 1.1 var(--font-display);
	}

	.count {
		color: var(--accent-text);
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.06em;
		white-space: nowrap;
	}

	.description,
	.preview {
		margin: 0;
	}

	.description {
		color: var(--ink-2);
		font-size: 11.5px;
		line-height: 1.4;
	}

	.preview {
		padding-top: 7px;
		border-top: 1px solid var(--border-hairline);
		color: var(--ink-3);
		font-size: 11px;
		line-height: 1.35;
	}

	@media (hover: hover) {
		.dish-card:hover {
			background-color: var(--bg-card-hover);
		}
	}
</style>
