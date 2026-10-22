<script lang="ts">
	import { browser } from '$app/env';
	import { imageSetOrPlaceholder, intrinsicSize, type PhotoRole, type Photos } from '#lib/media.ts';
	import { reportError } from '#lib/report-error.ts';

	type Props = {
		photos: Photos | null;
		role: PhotoRole;
		sizes: string;
		alt: string;
		baseUrl: string | undefined;
		// The above-the-fold photo (e.g. the recipe hero): eager, high fetch
		// priority, and preloaded from the head.
		priority?: boolean;
		// CSS lengths or token vars (the design's fixed heights and radii);
		// without them the caller sizes the box and Photo fills it.
		height?: string;
		radius?: string;
	};

	let { photos, role, sizes, alt, baseUrl, priority = false, height, radius }: Props = $props();

	// A bad prefix is a backend bug: log it once, on the server, not in every browser.
	const report = browser ? undefined : (err: unknown) => reportError('photo prefix rejected', err);

	const set = $derived(
		imageSetOrPlaceholder({ baseUrl, prefix: photos?.[role] ?? null, role, report })
	);
	const size = $derived(intrinsicSize(role));
	// The first <source> is what the browser picks (AVIF), so preloading it
	// never costs a second download in another format.
	const preload = $derived(priority ? set?.sources[0] : undefined);
</script>

<svelte:head>
	{#if preload}
		<link
			rel="preload"
			as="image"
			type={preload.type}
			imagesrcset={preload.srcset}
			imagesizes={sizes}
			fetchpriority="high"
		/>
	{/if}
</svelte:head>

{#if set}
	<picture style:height style:border-radius={radius}>
		{#each set.sources as source (source.type)}
			<source type={source.type} srcset={source.srcset} {sizes} />
		{/each}
		<img
			src={set.fallback.src}
			srcset={set.fallback.srcset}
			{sizes}
			{alt}
			loading={priority ? 'eager' : 'lazy'}
			fetchpriority={priority ? 'high' : undefined}
			decoding="async"
			width={size.width}
			height={size.height}
		/>
	</picture>
{:else}
	<div
		class="placeholder"
		style:height
		style:border-radius={radius}
		role={alt ? 'img' : undefined}
		aria-label={alt || undefined}
		aria-hidden={alt ? undefined : 'true'}
	></div>
{/if}

<style>
	picture,
	img,
	.placeholder {
		display: block;
		width: 100%;
		height: 100%;
		border-radius: inherit;
	}

	picture {
		overflow: hidden;
	}

	img {
		object-fit: cover;
	}

	.placeholder {
		background-image: var(--placeholder);
	}
</style>
