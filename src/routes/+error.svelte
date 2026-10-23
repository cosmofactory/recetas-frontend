<script lang="ts">
	import { page } from '$app/state';
	import PageHead from '#lib/components/PageHead.svelte';
	import { errorCopy } from '#lib/i18n/error-copy.ts';
	import { localeFromPath } from '#lib/i18n/locales.ts';
	import { localizedHref } from '#lib/i18n/localized-href.ts';
	import { ogImageUrl } from '#lib/seo/og-image.ts';

	// The path decides the language; /fr/ and /xx/... fall back to en.
	const locale = $derived(localeFromPath(page.url.pathname));
	const copy = $derived(errorCopy(page.status, locale));
</script>

<PageHead
	title={copy.title}
	description={copy.body}
	image={ogImageUrl({ origin: page.data.origin })}
/>

<main class="page-container">
	<h1>{copy.title}</h1>
	<p>{copy.body}</p>
	<a href={localizedHref('/', locale)}>{copy.backHome}</a>
</main>

<style>
	/* Accessibility: the one-line link grows its hit area to 44px (the --hit-inset pattern). */
	a {
		position: relative;
		display: inline-block;
	}

	a::before {
		content: '';
		position: absolute;
		inset: var(--hit-inset);
	}
</style>
