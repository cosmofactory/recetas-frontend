<script lang="ts">
	import { page } from '$app/state';
	import { localeFromPath } from '#lib/i18n/locales.ts';
	import { SITE_NAME } from '#lib/page-title.ts';
	import { ogLocales, TWITTER_CARD, type OgType } from '#lib/seo/share-meta.ts';

	// Every page's <title>, description and share tags (stage FE-8). og:url
	// sits with the canonical in the [lang] layout, so error pages have neither.
	type Props = { title: string; description: string; image: string; type?: OgType };

	let { title, description, image, type = 'website' }: Props = $props();

	const og = $derived(ogLocales(localeFromPath(page.url.pathname)));
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:type" content={type} />
	<meta property="og:site_name" content={SITE_NAME} />
	<meta property="og:locale" content={og.locale} />
	{#each og.alternates as alternate (alternate)}
		<meta property="og:locale:alternate" content={alternate} />
	{/each}
	<meta property="og:image" content={image} />
	<meta name="twitter:card" content={TWITTER_CARD} />
</svelte:head>
