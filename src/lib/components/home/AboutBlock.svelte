<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
</script>

<!-- The desktop home's one heading; the mobile header has its own (the logo). -->
<section class="about desktop-only">
	<h1 class="title">{m.desktop_aboutTitle()}</h1>
	<p class="body">{m.desktop_aboutBody()}</p>
</section>

<style>
	/*
	 * Desktop README -> Regional: "Below the map: top hairline, two columns —
	 * title "How Spain really cooks" (serif, clamp(28px, 2.6vw, 38px)) and a
	 * description paragraph (15.5px, lh 1.6)"; the prototype gives the margin,
	 * padding, column split, line-height 1.05 and the paragraph's padding-top.
	 */
	.about {
		display: grid;
		grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.15fr);
		gap: var(--about-gap);
		align-items: start;
		margin-top: 22px;
		padding: 28px 4px 0;
		border-top: 1px solid var(--border-about);
	}

	.title {
		margin: 0;
		font: 400 var(--about-title-size) / 1.05 var(--font-display);
		text-wrap: balance;
	}

	.body {
		margin: 0;
		padding-top: 4px;
		color: var(--ink-about);
		font-size: 15.5px;
		line-height: 1.6;
		text-wrap: pretty;
	}
</style>
