<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import RegionDetails from '#lib/content/RegionDetails.svelte';
	import UrlSheet from './UrlSheet.svelte';

	type Details = ComponentProps<typeof RegionDetails>;
	// region: the URL's (none: hidden); shown only while `active` (below
	// 860px). onClose asks to leave the region (scrim, Escape); `opener` is
	// the map link that opened it, if any.
	type Props = Omit<Details, 'region'> & {
		region: Details['region'] | undefined;
		active: boolean;
		onClose: () => void;
		opener: () => HTMLElement | undefined;
	};

	let { region, active, onClose, opener, ...details }: Props = $props();
</script>

<UrlSheet item={region} {active} {onClose} {opener}>
	{#snippet content(shown)}<RegionDetails region={shown} {...details} />{/snippet}
</UrlSheet>
