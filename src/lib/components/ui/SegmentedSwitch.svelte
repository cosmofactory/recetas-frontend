<script lang="ts">
	import { typeset } from '#lib/i18n/typeset.ts';
	import { ThumbDrag } from '#lib/ui/segmented-thumb-drag.svelte.ts';
	import { TablistFocus } from '#lib/ui/tablist-focus.svelte.ts';
	import SegmentedSwitchThumb from './SegmentedSwitchThumb.svelte';

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
		// WAI-ARIA tabs activation (TablistFocus).
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
	const keys = new TablistFocus({ tabs: () => tabs, activation: () => activation, select });
	const tabStop = $derived(keys.tabStop(selectedIndex));

	// A drag-select goes through the tab's own click, like a tap: a link
	// tab navigates (a new history entry), a button tab calls onChange.
	const drag = new ThumbDrag({
		tabs: () => tabs,
		selectedIndex: () => selectedIndex,
		choose: (index) => tabs[index].click()
	});
	$effect(() => drag.forgetHeld(selectedIndex));

	function select(index: number) {
		if (index === selectedIndex) return;
		value = options[index].value;
		onChange?.(value);
	}

	function selectOnClick(index: number) {
		if (options[index].href === undefined) select(index);
	}
</script>

<!-- svelte-ignore a11y_interactive_supports_focus (the tabs take focus; dragging is pointer-only, keys move between tabs) -->
<div
	class="track"
	role="tablist"
	aria-label={label}
	onpointerdown={drag.start}
	onpointermove={drag.move}
	onpointerup={drag.end}
	onpointercancel={drag.cancel}
	onclickcapture={drag.clickAfterDrag}
>
	<SegmentedSwitchThumb
		index={drag.restingIndex(Math.max(selectedIndex, 0))}
		count={options.length}
		offset={drag.offset}
	/>
	{#each options as option, index (option.value)}
		<!-- A link tab keeps focus on itself when the router navigates. -->
		<svelte:element
			this={option.href === undefined ? 'button' : 'a'}
			bind:this={tabs[index]}
			type={option.href === undefined ? 'button' : undefined}
			href={option.href}
			data-sveltekit-reset={option.href === undefined ? undefined : 'false'}
			draggable={option.href === undefined ? undefined : 'false'}
			role="tab"
			class="segment"
			class:desktop={size === 'desktop'}
			id={option.panelId ? `${option.panelId}-tab` : undefined}
			aria-controls={option.panelId}
			aria-selected={index === selectedIndex}
			tabindex={index === tabStop ? 0 : -1}
			onclick={() => selectOnClick(index)}
			onkeydown={(event: KeyboardEvent) => keys.moveWithKey(event, index)}
			onfocusout={keys.forgetFocus}
		>
			{typeset(option.label)}
		</svelte:element>
	{/each}
</div>

<style>
	/* Mobile README -> Header: "track: bg --bg-segment-track, radius 12px, padding 4px, gap 4px". */
	.track {
		--track-padding: 4px;
		--track-gap: 4px;
		position: relative;
		display: flex;
		gap: var(--track-gap);
		padding: var(--track-padding);
		border-radius: var(--radius-segment-track);
		background: var(--bg-segment-track);
		/* D-FE9-2: a sideways drag moves the thumb; vertical pans still scroll. */
		touch-action: pan-y;
		-webkit-user-select: none;
		user-select: none;
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
</style>
