<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
</script>

<!-- The home's one heading on both layouts (D-FE9-4): one block, restyled by CSS. -->
<section class="about">
	<h1 class="title">{m.home_aboutTitle()}</h1>
	<p class="body">{m.home_aboutBody()}</p>
</section>

<style>
	/* The desktop prototype's margin; the mobile README gives no spacing, so mobile shares it. */
	.about {
		margin-top: 22px;
		border-top: 1px solid var(--border-about);
	}

	.title {
		margin: 0;
		font-family: var(--font-display);
		font-weight: 400;
		line-height: 1.05;
		text-wrap: balance;
	}

	.body {
		margin: 0;
		text-wrap: pretty;
	}

	/*
	 * Mobile README -> Regional tab — body -> About (D-FE9-4): "top hairline,
	 * title (Instrument Serif ≈28px) and the description paragraph (≈14px,
	 * lh ≈1.55, ink-2), stacked". The text sits in by the meta row's 4px.
	 * The README gives no spacing: 22px matches the desktop margin (tokens
	 * space.9, the sheet content gutter), 10px the body's gap (space.4).
	 */
	@media not all and (min-width: 860px) {
		.about {
			display: flex;
			flex-direction: column;
			gap: 10px;
			padding: 22px 4px 0;
		}

		.title {
			font-size: var(--about-title-size-mobile);
		}

		.body {
			color: var(--ink-2);
			font-size: var(--about-body-size-mobile);
			line-height: var(--about-body-line-height-mobile);
		}
	}

	/*
	 * Desktop README -> Regional: "Below the map: top hairline, two columns —
	 * title "How Spain really cooks" (serif, clamp(28px, 2.6vw, 38px)) and a
	 * description paragraph (15.5px, lh 1.6)"; the prototype gives the margin,
	 * padding, column split, line-height 1.05 and the paragraph's padding-top.
	 */
	@media (min-width: 860px) {
		.about {
			display: grid;
			grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.15fr);
			gap: var(--about-gap);
			align-items: start;
			padding: 28px 4px 0;
		}

		.title {
			font-size: var(--about-title-size);
		}

		.body {
			padding-top: 4px;
			color: var(--ink-about);
			font-size: 15.5px;
			line-height: 1.6;
		}
	}
</style>
