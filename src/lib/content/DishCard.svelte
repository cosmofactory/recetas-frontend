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
		onclick?: (event: MouseEvent & { currentTarget: HTMLAnchorElement }) => void;
	};

	let { dish, href, mediaBaseUrl, onclick }: Props = $props();

	// Mobile: the list's full width. Desktop: a Popular grid column, at most
	// about 385px wide (two columns just before a third fits), so 400px covers
	// every column and never asks for more than the smaller card file.
	const PHOTO_SIZES = `${desktopQuery} 400px, 100vw`;
</script>

<!-- The whole card is one link; the photo is decorative, the name names it. -->
<a class="dish-card hover-lift" data-testid="dish-card" {href} {onclick}>
	<Photo
		photos={dish.photos}
		role="card"
		sizes={PHOTO_SIZES}
		alt=""
		baseUrl={mediaBaseUrl}
		height="var(--card-photo-height)"
		radius="var(--card-photo-radius)"
	/>
	<div class="text">
		<div class="name-row">
			<h3 class="name">{dish.name}</h3>
			<span class="count">{m.home_variation({ count: dish.variations.length })}</span>
		</div>
		<p class="description">{dish.description}</p>
		<p class="preview">{dishPreview(dish)}</p>
	</div>
</a>

<style>
	/* Mobile README -> Popular tab "Card" and the mobile prototype (DishCard.svelte.spec.ts quotes them). */
	.dish-card {
		--card-photo-height: 96px;
		--card-photo-radius: var(--radius-card-photo);
		display: flex;
		flex-direction: column;
		gap: 7px;
		padding: 14px 15px;
		border: 1px solid var(--border-card);
		border-radius: var(--radius-card);
		background: var(--bg-surface);
		color: var(--ink);
		text-decoration: none;
	}

	/* Mobile: the text is part of the card's own column. */
	.text {
		display: contents;
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

	/* The desktop card lifts instead (.hover-lift). */
	@media not all and (min-width: 860px) {
		.dish-card {
			transition: background-color var(--dur-colour);
		}

		@media (hover: hover) {
			.dish-card:hover {
				background-color: var(--bg-card-hover);
			}
		}
	}

	/* Desktop README -> Popular "Card" and the desktop prototype's card (L158–168). */
	@media (min-width: 860px) {
		.dish-card {
			--card-photo-height: 180px;
			--card-photo-radius: var(--radius-card-photo-desktop);
			gap: 10px;
			padding: 14px 14px 18px;
			border-radius: var(--radius-card-desktop);
		}

		.text {
			display: flex;
			flex-direction: column;
			gap: 7px;
			padding: 4px 4px 0;
		}

		.name-row {
			gap: 12px;
		}

		.name {
			font-size: 25px;
		}

		.count {
			font-size: 12px;
			letter-spacing: 0.04em;
		}

		.description {
			font-size: 13.5px;
			line-height: 1.45;
			text-wrap: pretty;
		}

		.preview {
			margin-top: 3px;
			padding-top: 9px;
			font-size: 12px;
			line-height: 1.4;
		}
	}
</style>
