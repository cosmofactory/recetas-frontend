<script lang="ts">
	import { onMount } from 'svelte';
	import { NO_ACTIVE_OPTION } from '#lib/search/active-option.ts';
	import { SearchCombobox } from '#lib/search/search-combobox.svelte.ts';
	import type { SearchEntry } from '#lib/search/search-index.ts';
	import { pushEscapeLayer } from '#lib/ui/escape-layers.ts';
	import { motionFor, prefersReducedMotion } from '#lib/ui/motion.svelte.ts';
	import { focusLeft, onPointerDownOutside } from '#lib/ui/outside-dismiss.ts';
	import SearchField from './SearchField.svelte';
	import SearchNothing from './SearchNothing.svelte';
	import SearchResults from './SearchResults.svelte';
	import SearchSuggestions from './SearchSuggestions.svelte';

	// The desktop top bar's inline search (desktop README -> Top bar; stage
	// FE-7 PR 4), controlled like SearchOverlay: `open` shows the dropdown,
	// onOpen asks to open it (focus, a click, typing), onClose asks to close
	// it (Escape, a press outside, focus leaving the search), onSelect reports
	// a picked result. The query is in memory only; Escape and an outside
	// press keep it, a pick clears it. The field is disabled until hydrated.
	type Props = {
		open: boolean;
		index: SearchEntry[];
		onOpen: () => void;
		onClose: () => void;
		onSelect: (entry: SearchEntry) => void;
		input?: HTMLInputElement;
	};

	let { open, index, onOpen, onClose, onSelect, input = $bindable() }: Props = $props();

	const uid = $props.id();
	const listboxId = `${uid}-listbox`;
	const optionId = (position: number) => `${uid}-option-${position}`;
	// APG combobox: while collapsed, the arrows open the popup and nothing is active.
	const OPENING_KEYS = new Set(['ArrowDown', 'ArrowUp']);

	let search: HTMLElement | undefined = $state();
	let hydrated = $state(false);
	const combobox = new SearchCombobox(() => index);
	const fade = $derived(motionFor(prefersReducedMotion.current) === 'fade');
	const expanded = $derived(open && combobox.entries.length > 0);

	onMount(() => {
		hydrated = true;
	});

	$effect(() => {
		if (!open) return;
		return pushEscapeLayer('search', () => onClose());
	});

	$effect(() => {
		if (!open || !search) return;
		return onPointerDownOutside(search, () => onClose());
	});

	// However the dropdown closed, it reopens with no option active.
	$effect.pre(() => {
		if (!open) combobox.active = NO_ACTIVE_OPTION;
	});

	$effect(() => {
		if (!open || combobox.active === NO_ACTIVE_OPTION) return;
		document.getElementById(optionId(combobox.active))?.scrollIntoView({ block: 'nearest' });
	});

	const requestOpen = () => {
		if (!open) onOpen();
	};

	function onInput(next: string) {
		combobox.setQuery(next);
		requestOpen();
	}

	// A chip or the clear "×": a new query, and focus back in the field.
	function fillQuery(next: string) {
		combobox.setQuery(next);
		input?.focus();
	}

	function onKeydown(event: KeyboardEvent) {
		if (open) return combobox.onKeydown(event, pick);
		if (!OPENING_KEYS.has(event.key)) return;
		event.preventDefault();
		onOpen();
	}

	function pick(entry: SearchEntry) {
		combobox.setQuery('');
		onSelect(entry);
	}

	function onfocusout(event: FocusEvent) {
		if (open && search && focusLeft(event, search)) onClose();
	}

	// A press anywhere in the dropdown keeps focus in the combobox input.
	const keepFocus = (event: MouseEvent) => event.preventDefault();
</script>

<div bind:this={search} class="desktop-search" {onfocusout}>
	<SearchField
		query={combobox.query}
		bind:input
		listboxId={expanded ? listboxId : undefined}
		activeId={expanded && combobox.activeEntry ? optionId(combobox.active) : undefined}
		{onInput}
		onClear={() => fillQuery('')}
		{onKeydown}
		size="desktop"
		{open}
		disabled={!hydrated}
		onFocus={requestOpen}
		onClick={requestOpen}
	/>
	<!-- svelte-ignore a11y_no_static_element_interactions (mousedown only keeps focus in the input) -->
	<div
		class="dropdown"
		class:open
		class:fade
		data-testid="search-dropdown"
		inert={!open}
		onmousedown={keepFocus}
	>
		{#if combobox.blank}
			<SearchSuggestions onPick={fillQuery} />
		{:else if combobox.entries.length > 0}
			<SearchResults
				id={listboxId}
				results={combobox.results}
				active={combobox.active}
				{optionId}
				onSelect={(position) => pick(combobox.entries[position])}
			/>
		{:else}
			<SearchNothing query={combobox.query} />
		{/if}
	</div>
</div>

<style>
	/* Desktop README -> Top bar: "width clamp(220px, 25vw, 360px)"; prototype "flex:0 1 auto;min-width:0". */
	.desktop-search {
		position: relative;
		flex: 0 1 auto;
		width: clamp(220px, 25vw, 360px);
		min-width: 0;
	}

	/*
	 * Desktop README: "a dropdown under the field (width min(440px, 100vw −
	 * 48px), max-height 520px, radius 18px, shadow …)". Prototype: "top:54px;
	 * right:0", 1px rgba(43,30,22,.1), "padding:12px 14px 14px", and the
	 * language menu's motion (opacity .18s, transform .22s from −6px).
	 * Closed, it paints nothing once the slide is over.
	 */
	.dropdown {
		position: absolute;
		top: 54px;
		right: 0;
		box-sizing: border-box;
		width: min(440px, calc(100vw - 48px));
		max-height: 520px;
		padding: 12px 14px 14px;
		overflow-y: auto;
		overscroll-behavior: contain;
		border: 1px solid var(--border-card);
		border-radius: 18px;
		background: var(--bg-surface);
		box-shadow: var(--shadow-search-dropdown);
		color: var(--ink);
		opacity: 0;
		visibility: hidden;
		transform: translateY(var(--menu-enter-offset));
		transition-property: opacity, transform, visibility;
		transition-duration: var(--dur-menu-fade), var(--dur-menu), 0s;
		transition-timing-function: ease, var(--ease), linear;
		transition-delay: 0s, 0s, var(--dur-menu);
	}

	.dropdown.open {
		opacity: 1;
		visibility: visible;
		transform: none;
		transition-delay: 0s;
	}

	/* Accessibility: under reduced motion the slide becomes a fade. */
	.dropdown.fade {
		transform: none;
		transition-property: opacity, visibility;
		transition-duration: var(--dur-menu-fade), 0s;
		transition-delay: 0s, var(--dur-menu-fade);
	}

	.dropdown.fade.open {
		transition-delay: 0s;
	}
</style>
