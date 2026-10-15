<script lang="ts">
	import { page } from '$app/state';
	import { headLinks } from '#lib/i18n/head-links.ts';
	import type { LayoutProps } from './$types';

	let { children, data }: LayoutProps = $props();

	const links = $derived(headLinks(data.origin, page.url));
</script>

<svelte:head>
	{#if !page.error}
		<link rel="canonical" href={links.canonical} />
		{#each links.alternates as alternate (alternate.hreflang)}
			<link rel="alternate" hreflang={alternate.hreflang} href={alternate.href} />
		{/each}
	{/if}
</svelte:head>

{@render children()}
