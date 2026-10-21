<script lang="ts">
	import type { components } from '#lib/api/schema.d.ts';
	import DishDetails from '#lib/content/DishDetails.svelte';
	import { recipeHref, variationsHref } from '#lib/i18n/localized-href.ts';
	import UrlSheet from './UrlSheet.svelte';

	// D-FE5-2: the dish the URL's ?dish opens (none or unknown: hidden); shown
	// only while `active` (below 860px). onClose asks to leave it (scrim,
	// Escape); `opener` is the card that opened it, if any.
	type Props = {
		dish: components['schemas']['Dish'] | undefined;
		active: boolean;
		lang: string;
		mediaBaseUrl: string | undefined;
		onClose: () => void;
		opener: () => HTMLElement | undefined;
	};

	let { dish, active, lang, mediaBaseUrl, onClose, opener }: Props = $props();

	const recipeHrefFor = (dishKey: string, regionKey: string) =>
		recipeHref(dishKey, regionKey, lang);
</script>

<UrlSheet item={dish} {active} {onClose} {opener}>
	{#snippet content(shown)}
		<DishDetails
			dish={shown}
			variationsHref={variationsHref(shown.key, lang)}
			recipeHref={recipeHrefFor}
			{mediaBaseUrl}
		/>
	{/snippet}
</UrlSheet>
