<script lang="ts">
	import TextButton from '#lib/components/ui/TextButton.svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { NO_ACTIVE_OPTION } from '#lib/search/active-option.ts';
	import { SearchCombobox } from '#lib/search/search-combobox.svelte.ts';
	import type { SearchEntry } from '#lib/search/search-index.ts';
	import { afterOwnTransitions } from '#lib/ui/after-transitions.ts';
	import { motionFor, prefersReducedMotion } from '#lib/ui/motion.svelte.ts';
	import { sheetKeyboard } from '#lib/ui/sheet-keyboard.svelte.ts';
	import SearchField from './SearchField.svelte';
	import SearchNothing from './SearchNothing.svelte';
	import SearchResults from './SearchResults.svelte';
	import SearchSuggestions from './SearchSuggestions.svelte';

	// The mobile search overlay (mobile README -> Overlay — Search), controlled
	// like OverlaySheet: `open` shows it, onClose asks to close it (Cancel,
	// Escape), onSelect reports a picked result. The query is in memory only
	// and cleared by any close. opener: the button that opened it (WebKit
	// doesn't focus a button on tap).
	type Props = {
		open: boolean;
		index: SearchEntry[];
		onClose: () => void;
		onSelect: (entry: SearchEntry) => void;
		opener?: HTMLElement;
	};

	let { open, index, onClose, onSelect, opener }: Props = $props();

	const uid = $props.id();
	const listboxId = `${uid}-listbox`;
	const optionId = (position: number) => `${uid}-option-${position}`;

	let dialog: HTMLElement | undefined = $state();
	let input: HTMLInputElement | undefined = $state();
	const combobox = new SearchCombobox(() => index);
	const fade = $derived(motionFor(prefersReducedMotion.current) === 'fade');

	sheetKeyboard({
		sheet: () => dialog,
		kind: 'search',
		shown: () => open,
		modal: () => open,
		onEscape: () => onClose(),
		opener: () => opener,
		focusOnModal: false
	});

	// README: "Input auto-focuses after the transition".
	$effect(() => {
		if (!open || !dialog) return;
		let current = true;
		void afterOwnTransitions(dialog).then((finished) => {
			if (current && finished) input?.focus();
		});
		return () => (current = false);
	});

	$effect.pre(() => {
		if (!open) combobox.setQuery('');
	});

	$effect(() => {
		if (combobox.active === NO_ACTIVE_OPTION) return;
		document.getElementById(optionId(combobox.active))?.scrollIntoView({ block: 'nearest' });
	});

	// A chip or the clear "×": a new query, and focus back in the field.
	function fillQuery(next: string) {
		combobox.setQuery(next);
		input?.focus();
	}
</script>

<div
	bind:this={dialog}
	class="search"
	class:open
	class:fade
	role="dialog"
	aria-modal={open ? 'true' : undefined}
	aria-label={m.a11y_search()}
	tabindex="-1"
	inert={!open}
>
	<div class="top">
		<SearchField
			query={combobox.query}
			bind:input
			listboxId={combobox.entries.length > 0 ? listboxId : undefined}
			activeId={combobox.activeEntry ? optionId(combobox.active) : undefined}
			onInput={(next) => combobox.setQuery(next)}
			onClear={() => fillQuery('')}
			onKeydown={(event) => combobox.onKeydown(event, onSelect)}
		/>
		<TextButton label={m.search_cancel()} onclick={onClose} />
	</div>
	<div class="body">
		{#if combobox.blank}
			<SearchSuggestions onPick={fillQuery} />
		{:else if combobox.entries.length > 0}
			<SearchResults
				id={listboxId}
				results={combobox.results}
				active={combobox.active}
				{optionId}
				onSelect={(position) => onSelect(combobox.entries[position])}
			/>
		{:else}
			<SearchNothing query={combobox.query} />
		{/if}
	</div>
</div>

<style>
	/*
	 * "Full-screen, above everything. Enter: opacity 0 → 1 (250ms) and
	 * translateY 24px → 0 (350ms --ease)." Closed, it paints nothing once the
	 * slide is over (visibility, as OverlaySheet's layer).
	 */
	.search {
		position: fixed;
		inset: 0;
		z-index: var(--z-search);
		display: flex;
		flex-direction: column;
		background: var(--bg-page);
		color: var(--ink);
		opacity: 0;
		visibility: hidden;
		transform: translateY(var(--search-enter-offset));
		transition-property: opacity, transform, visibility;
		transition-duration: var(--dur-search-fade), var(--dur-search), 0s;
		transition-timing-function: var(--ease);
		transition-delay: 0s, 0s, var(--dur-search);
	}

	.search.open {
		opacity: 1;
		visibility: visible;
		transform: none;
		transition-delay: 0s;
	}

	/* Accessibility: under reduced motion the slide becomes a fade. */
	.search.fade {
		transform: none;
		transition-property: opacity, visibility;
		transition-duration: var(--dur-search-fade), 0s;
		transition-delay: 0s, var(--dur-search-fade);
	}

	.search.fade.open {
		transition-delay: 0s;
	}

	/* "Top row (padding 16px 16px 12px, gap 12px)". */
	.top {
		display: flex;
		flex: none;
		align-items: center;
		gap: 12px;
		padding: 16px 16px 12px;
	}

	/* Prototype: the list scrolls under the top row, "padding:6px 20px 30px". */
	.body {
		flex: 1;
		min-height: 0;
		padding: 6px 20px 30px;
		overflow: hidden auto;
		overscroll-behavior: contain;
		scrollbar-width: none;
	}
</style>
