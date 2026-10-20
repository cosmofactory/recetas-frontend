<script lang="ts">
	import { tabIndexForKey } from '#lib/ui/tablist.ts';

	// panelId: the id of the tabpanel the tab controls; the tab is then
	// `${panelId}-tab`, for the panel's aria-labelledby.
	type Option = { value: string; label: string; panelId?: string };
	type Props = {
		options: Option[];
		value: string;
		// The tablist's accessible name (a message).
		label: string;
		onChange?: (value: string) => void;
		// The desktop top bar's switch sets its labels a little larger.
		size?: 'regular' | 'desktop';
	};

	let { options, value = $bindable(), label, onChange, size = 'regular' }: Props = $props();

	const tabs: HTMLButtonElement[] = $state([]);
	const selectedIndex = $derived(options.findIndex((option) => option.value === value));
	// A value no option has must not take the switch out of the Tab order.
	const tabStop = $derived(Math.max(selectedIndex, 0));

	function select(index: number) {
		if (index === selectedIndex) return;
		value = options[index].value;
		onChange?.(value);
	}

	// Automatic activation: moving focus selects.
	function moveWithKey(event: KeyboardEvent, index: number) {
		const next = tabIndexForKey(event.key, index, options.length);
		if (next === undefined) return;
		event.preventDefault();
		select(next);
		tabs[next].focus();
	}
</script>

<div class="track" role="tablist" aria-label={label}>
	{#each options as option, index (option.value)}
		<button
			bind:this={tabs[index]}
			type="button"
			role="tab"
			class="segment"
			class:desktop={size === 'desktop'}
			id={option.panelId ? `${option.panelId}-tab` : undefined}
			aria-controls={option.panelId}
			aria-selected={index === selectedIndex}
			tabindex={index === tabStop ? 0 : -1}
			onclick={() => select(index)}
			onkeydown={(event) => moveWithKey(event, index)}
		>
			{option.label}
		</button>
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
