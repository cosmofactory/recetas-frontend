<script lang="ts">
	import { dev } from '$app/env';
	import { page } from '$app/state';
	import Photo from '#lib/components/Photo.svelte';
	import Chip from '#lib/components/ui/Chip.svelte';
	import ChipRow from '#lib/components/ui/ChipRow.svelte';
	import IconButton from '#lib/components/ui/IconButton.svelte';
	import PrimaryButton from '#lib/components/ui/PrimaryButton.svelte';
	import SegmentedSwitch from '#lib/components/ui/SegmentedSwitch.svelte';
	import TextButton from '#lib/components/ui/TextButton.svelte';
	import { localizedHref, variationsHref } from '#lib/i18n/localized-href.ts';
	import { m } from '#lib/paraglide/messages.js';
	import ContainersDemo from './ContainersDemo.svelte';
	import DesktopTopBarDemo from './DesktopTopBarDemo.svelte';
	import NavigationDemo from './NavigationDemo.svelte';
	import { PHOTO_SIZES, PHOTO_SLOTS, browseTabs, filterLabels, iconButtons } from './gallery.ts';
	import type { PageProps } from './$types';

	// Dev only: every FE-3 control in its states, for side-by-side checks
	// against the prototypes. +page.server.ts answers 404 elsewhere, and the
	// body sits under `dev` (a build-time constant), so builds drop it.
	let { data }: PageProps = $props();

	const labels = dev ? filterLabels() : [];
	// The first chip starts on, so both states show side by side.
	const pressed: boolean[] = $state(labels.map((_, index) => index === 0));
	let tab = $state(browseTabs()[0].value);
	const dish = $derived(data.dishes[0]);
	const region = $derived(data.regions[0]);
	const dishHref = $derived(dish ? variationsHref(dish.key, page.params.lang!) : '');
	const homeHref = $derived(localizedHref('/', page.params.lang!));
	const popularHref = $derived(localizedHref('/?tab=popular', page.params.lang!));
</script>

<svelte:head>
	{#if dev}
		<title>{m.devUi_title()}</title>
		<meta name="robots" content="noindex" />
	{/if}
</svelte:head>

{#if dev}
	<main class="gallery">
		<h1>{m.devUi_title()}</h1>

		<section>
			<h2>{m.devUi_iconButtons()}</h2>
			<div class="row">
				{#each iconButtons() as { icon, label } (icon)}
					<IconButton {icon} {label} />
				{/each}
			</div>
		</section>

		<section>
			<h2>{m.devUi_chips()}</h2>
			{#each [false, true] as wrap (wrap)}
				<ChipRow {wrap}>
					{#each labels as label, index (label)}
						<Chip {label} pressed={pressed[index]} onToggle={(next) => (pressed[index] = next)} />
					{/each}
				</ChipRow>
			{/each}
		</section>

		<section>
			<h2>{m.devUi_segmentedSwitch()}</h2>
			<div class="switch">
				<SegmentedSwitch
					options={browseTabs()}
					bind:value={tab}
					label={m.devUi_segmentedSwitch()}
				/>
			</div>
		</section>

		<section>
			<h2>{m.devUi_buttons()}</h2>
			<PrimaryButton label={m.home_seeAll()} href={dishHref} />
			<PrimaryButton label={m.home_showResults()} size="compact" />
			<div class="row">
				<TextButton label={m.search_cancel()} />
				<TextButton label={m.home_clearAll()} size="small" />
			</div>
		</section>

		<section>
			<h2>{m.devUi_photos()}</h2>
			{#each PHOTO_SLOTS as slot, index (index)}
				<Photo
					photos={slot.placeholder ? null : (dish?.photos ?? null)}
					role={slot.role}
					sizes={PHOTO_SIZES}
					alt={dish?.name ?? ''}
					baseUrl={data.mediaBaseUrl}
					height={slot.height}
					radius={slot.radius}
				/>
			{/each}
		</section>

		<ContainersDemo title={region?.name ?? ''} body={region?.description ?? ''} />

		<NavigationDemo title={dish?.name ?? ''} {homeHref} {popularHref} />

		<DesktopTopBarDemo {homeHref} lang={page.params.lang!} />
	</main>
{/if}

<style>
	.gallery {
		display: grid;
		gap: var(--desktop-gap);
		padding: var(--gutter);
	}

	section {
		display: grid;
		gap: var(--chip-gap);
	}

	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--gutter);
	}

	/* Desktop README -> Top bar: the switch is "clamp(240px, 22vw, 320px)" wide. */
	.switch {
		width: var(--switch-width-desktop);
	}
</style>
