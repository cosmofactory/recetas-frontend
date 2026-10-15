<script lang="ts">
	import { page } from '$app/state';
	import { errorCopy } from '#lib/i18n/error-copy.ts';
	import { localeFromPath } from '#lib/i18n/locales.ts';
	import { localizedHref } from '#lib/i18n/localized-href.ts';

	// The path decides the language; /fr/ and /xx/... fall back to en.
	const locale = $derived(localeFromPath(page.url.pathname));
	const copy = $derived(errorCopy(page.status, locale));
</script>

<svelte:head>
	<title>{copy.title}</title>
</svelte:head>

<h1>{copy.title}</h1>
<p>{copy.body}</p>
<a href={localizedHref('/', locale)}>{copy.backHome}</a>
