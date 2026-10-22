<script lang="ts">
	import { tabIndexForKey } from '#lib/ui/tablist.ts';

	// panelId: the id of the tabpanel the tab controls; the tab is then
	// `${panelId}-tab`, for the panel's aria-labelledby. href: the tab is a
	// link to its URL (works without JS); a click is the link's own
	// navigation, and only arrow keys call onChange.
	type Option = { value: string; label: string; panelId?: string; href?: string };
	type Props = {
		options: Option[];
		value: string;
		// The tablist's accessible name (a message).
		label: string;
		onChange?: (value: string) => void;
		// The desktop top bar's switch sets its labels a little larger.
		size?: 'regular' | 'desktop';
		// WAI-ARIA tabs: 'auto' selects as the keys move focus; 'manual' only
		// moves focus (roving tabindex), and Enter or a click activates.
		activation?: 'auto' | 'manual';
	};

	let {
		options,
		value = $bindable(),
		label,
		onChange,
		size = 'regular',
		activation = 'auto'
	}: Props = $props();

	const tabs: HTMLElement[] = $state([]);
	const selectedIndex = $derived(options.findIndex((option) => option.value === value));
	// Manual activation: the tab the keys last moved focus to.
	let focusedIndex = $state<number | undefined>(undefined);
	// A value no option has must not take the switch out of the Tab order.
	const tabStop = $derived(focusedIndex ?? Math.max(selectedIndex, 0));

	function select(index: number) {
		if (index === selectedIndex) return;
		value = options[index].value;
		onChange?.(value);
	}

	function selectOnClick(index: number) {
		if (options[index].href === undefined) select(index);
	}

	// Automatic activation: moving focus selects. Manual: it only moves focus.
	function moveWithKey(event: KeyboardEvent, index: number) {
		const next = tabIndexForKey(event.key, index, options.length);
		if (next === undefined) return;
		event.preventDefault();
		if (activation === 'auto') select(next);
		else focusedIndex = next;
		tabs[next].focus();
	}

	// Leaving the switch hands the Tab stop back to the selected tab.
	function forgetFocus(event: FocusEvent) {
		const next = event.relatedTarget;
		if (!(next instanceof HTMLElement) || !tabs.includes(next)) focusedIndex = undefined;
	}
</script>

<div class="track" role="tablist" aria-label={label}>
	{#each options as option, index (option.value)}
		<!-- A link tab keeps focus on itself when the router navigates. -->
		<svelte:element
			this={option.href === undefined ? 'button' : 'a'}
			bind:this={tabs[index]}
			type={option.href === undefined ? 'button' : undefined}
			href={option.href}
			data-sveltekit-reset={option.href === undefined ? undefined : 'false'}
			role="tab"
			class="segment"
			class:desktop={size === 'desktop'}
			id={option.panelId ? `${option.panelId}-tab` : undefined}
			aria-controls={option.panelId}
			aria-selected={index === selectedIndex}
			tabindex={index === tabStop ? 0 : -1}
			onclick={() => selectOnClick(index)}
			onkeydown={(event: KeyboardEvent) => moveWithKey(event, index)}
			onfocusout={forgetFocus}
		>
			{option.label}
		</svelte:element>
	{/each}
</div>

<style>
	/* Mobile README -> Header: "track: bg --bg-segment-track, radius 12px, padding 4px, gap 4px". */
	.track {
		display: flex;
		gap: 4px;
		padding: 4px;
		border-radius: var(--radius-segment-track);
		background: var(--bg-segment-track);
	}

	/* "Each segment flex:1, padding 9px 0, centred, Archivo 13px/600". */
	.segment {
		position: relative;
		flex: 1;
		min-width: 0;
		padding: 9px 0;
		border: 0;
		border-radius: var(--radius-segment);
		background: transparent;
		color: var(--ink);
		font: 600 13px var(--font-text);
		text-align: center;
		text-decoration: none;
		white-space: nowrap;
		cursor: pointer;
		transition: background-color var(--dur-colour);
	}

	/* Desktop prototype top bar: "font-size:13.5px;font-weight:600". */
	.segment.desktop {
		font-size: 13.5px;
	}

	.segment::before {
		content: '';
		position: absolute;
		inset: var(--hit-inset);
	}

	/* "Active: bg --bg-surface, radius 9px, shadow --shadow-segment-active". */
	.segment[aria-selected='true'] {
		background: var(--bg-surface);
		box-shadow: var(--shadow-segment-active);
	}
</style>
