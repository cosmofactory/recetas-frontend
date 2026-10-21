<script lang="ts">
	import Photo from '#lib/components/Photo.svelte';
	import { ICONS } from '#lib/components/ui/icons.ts';
	import { desktopQuery } from '#lib/ui/breakpoints.ts';
	import type { RegionVariationRow } from './region-variations.ts';

	type Props = { row: RegionVariationRow; href: string; mediaBaseUrl: string | undefined };

	let { row, href, mediaBaseUrl }: Props = $props();

	// Mobile README: a 52px thumb; desktop README: 64px.
	const THUMB_SIZES = `${desktopQuery} 64px, 52px`;
	// Desktop prototype: the "›" is 20px.
	const CHEVRON_PX = 20;
	const Chevron = ICONS.forward;
</script>

<!-- The whole row is one link; the photo is decorative, the name names it. -->
<a class="row" {href}>
	<span class="thumb">
		<Photo photos={row.photos} role="thumb" sizes={THUMB_SIZES} alt="" baseUrl={mediaBaseUrl} />
	</span>
	<span class="text">
		<span class="name">{row.name}</span>
		<span class="description">{row.description}</span>
	</span>
	<span class="chevron desktop-only" aria-hidden="true">
		<Chevron size={CHEVRON_PX} />
	</span>
</a>

<style>
	/*
	 * Mobile README -> Region sheet: "Row: padding 11px 0, hairline bottom
	 * border, flex row gap 12px, centred: 52×52 photo, radius 10px. Column,
	 * gap 3px: variation name (Instrument Serif 19px) and its description
	 * (11.5px ink-2, lh 1.35)"; the prototype's name line-height is 1.15.
	 */
	.row {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 11px 0;
		border-bottom: 1px solid var(--border-hairline);
		color: var(--ink);
		text-decoration: none;
	}

	.thumb {
		flex: none;
		width: 52px;
		height: 52px;
		overflow: hidden;
		border-radius: var(--radius-thumb);
	}

	.text {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 3px;
		min-width: 0;
	}

	.name {
		font: 400 19px / 1.15 var(--font-display);
	}

	.description {
		color: var(--ink-2);
		font-size: 11.5px;
		line-height: 1.35;
	}

	/*
	 * Desktop README -> Regional: "list rows (64px thumb, 22px serif name,
	 * 13.5px description, chevron, hover --bg-surface-muted)"; the prototype
	 * gives the row padding, radius and gap, and no bottom border.
	 */
	@media (min-width: 860px) {
		.row {
			gap: 16px;
			padding: 12px 10px;
			border-bottom: 0;
			border-radius: var(--radius-region-row-desktop);
			transition: background-color var(--dur-colour);
		}

		.thumb {
			width: 64px;
			height: 64px;
			border-radius: var(--radius-thumb-desktop);
		}

		.text {
			gap: 4px;
		}

		.name {
			font-size: 22px;
		}

		.description {
			font-size: 13.5px;
			line-height: 1.4;
		}

		.chevron {
			display: flex;
			flex: none;
			color: var(--ink-row-chevron);
		}

		@media (hover: hover) {
			.row:hover {
				background-color: var(--bg-surface-muted);
			}
		}
	}
</style>
