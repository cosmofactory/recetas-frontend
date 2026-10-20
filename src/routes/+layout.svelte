<script lang="ts">
	import '#lib/styles/tokens.css';
	import '#lib/styles/layout.css';
	import '#lib/styles/page-push.css';
	import '#lib/styles/fonts.css';
	import '#lib/styles/global.css';
	import { page } from '$app/state';
	import favicon from '#lib/assets/favicon.svg';
	import { localeFromPath } from '#lib/i18n/locales.ts';
	import { pagePush } from '#lib/ui/page-push.svelte.ts';
	import archivoLatin400 from '@fontsource/archivo/files/archivo-latin-400-normal.woff2?url';
	import instrumentSerifLatin400 from '@fontsource/instrument-serif/files/instrument-serif-latin-400-normal.woff2?url';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	pagePush();

	// The server sets <html lang> per request; client navigations keep it in
	// step with the URL.
	$effect(() => {
		document.documentElement.lang = localeFromPath(page.url.pathname);
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<link
		rel="preload"
		as="font"
		type="font/woff2"
		crossorigin="anonymous"
		href={instrumentSerifLatin400}
	/>
	<link rel="preload" as="font" type="font/woff2" crossorigin="anonymous" href={archivoLatin400} />
</svelte:head>

<div data-testid="app-shell" class="app-shell">{@render children()}</div>
