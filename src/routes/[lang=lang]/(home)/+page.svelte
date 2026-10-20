<script lang="ts">
	import { page } from '$app/state';
	import { homeDescription, homeTitle } from '#lib/components/home/home-head.ts';
	import { tabFromUrl } from '#lib/ui/home-tab.ts';

	// The screen itself renders in the (home) layout; region pages set their
	// own title (FE-4 PR 3).
	const title = $derived(homeTitle(tabFromUrl(page.url)));
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={homeDescription()} />
</svelte:head>
