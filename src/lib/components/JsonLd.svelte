<script lang="ts">
	import { jsonLdScriptTag } from '#lib/seo/json-ld.ts';

	// Structured data in the page head (stage FE-8). The escaping lives only in
	// serializeJsonLd, which is why this is the one {@html} in the app.
	let { data }: { data: unknown } = $props();
</script>

<svelte:head>
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- serializeJsonLd escapes every "<" -->
	{@html jsonLdScriptTag(data)}
</svelte:head>
