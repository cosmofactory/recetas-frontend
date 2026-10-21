<script lang="ts">
	import TextButton from '#lib/components/ui/TextButton.svelte';
	import FilterGroups from '#lib/content/FilterGroups.svelte';
	import { m } from '#lib/paraglide/messages.js';

	// The desktop filter sidebar, controlled like the Filters sheet: `active`
	// is the URL's filters; a chip or "Clear all" asks the screen to navigate.
	// "Clear all" stays focusable while nothing is active (aria-disabled),
	// so a press never drops focus (stage FE-5 -> Small decisions).
	type Props = {
		active: readonly string[];
		onToggle: (id: string) => void;
		onClear: () => void;
	};

	let { active, onToggle, onClear }: Props = $props();

	// Unique in the page, whatever else renders FilterGroups.
	const uid = $props.id();
	const headingId = `${uid}-heading`;
</script>

<section
	class="filter-sidebar desktop-only"
	data-testid="filter-sidebar"
	aria-labelledby={headingId}
>
	<div class="header">
		<h3 class="title" id={headingId}>{m.home_filters()}</h3>
		<TextButton
			label={m.home_clearAll()}
			size="small"
			inactive={active.length === 0}
			onclick={onClear}
		/>
	</div>
	<FilterGroups {active} {onToggle} size="desktop" />
</section>

<style>
	/*
	 * Desktop README -> Popular: "left sticky filter sidebar (all four groups
	 * always visible as wrapping chips)"; the prototype: "position:sticky;
	 * top:28px; flex column; gap:22px", its header "Filters" (serif 27px) and
	 * "Clear all" on one baseline, space-between. Capped at the window like
	 * StickyPanel, so in a short window it scrolls itself and Tab never
	 * focuses a chip below the viewport.
	 */
	.filter-sidebar {
		position: sticky;
		top: var(--panel-top);
		display: flex;
		flex-direction: column;
		gap: 22px;
		max-height: calc(100dvh - var(--panel-top));
		overflow-y: auto;
		overscroll-behavior: contain;
	}

	.header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
	}

	.title {
		margin: 0;
		font: 400 27px var(--font-display);
	}
</style>
