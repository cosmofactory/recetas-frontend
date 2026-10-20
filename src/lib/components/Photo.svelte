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
		// The above-the-fold photo (e.g. the recipe hero): eager, high fetch priority.
		priority?: boolean;
	};

	let { photos, role, sizes, alt, baseUrl, priority = false }: Props = $props();

	// A bad prefix is a backend bug: log it once, on the server, not in every browser.
	const report = browser ? undefined : (err: unknown) => reportError('photo prefix rejected', err);

	const set = $derived(
		imageSetOrPlaceholder({ baseUrl, prefix: photos?.[role] ?? null, role, report })
	);
	const size = $derived(intrinsicSize(role));
</script>

{#if set}
	<picture>
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

	img {
		object-fit: cover;
	}

	.placeholder {
		background-image: var(--placeholder);
	}
</style>
