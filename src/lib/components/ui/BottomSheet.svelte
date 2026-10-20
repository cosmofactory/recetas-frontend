<script lang="ts">
	import type { Snippet } from 'svelte';
	import { placeWhileFading } from '#lib/ui/fade-out.svelte.ts';
	import { motionFor, prefersReducedMotion } from '#lib/ui/motion.svelte.ts';
	import { sheetKeyboard } from '#lib/ui/sheet-keyboard.svelte.ts';
	import {
		isSheetModal,
		sheetScrimOpacity,
		toggledSheetState,
		type SheetState
	} from '#lib/ui/sheet.ts';
	import Scrim from './Scrim.svelte';

	// The mobile container (F6) for the region and dish sheets, controlled: it
	// shows `state` and asks for a new one through onStateChange. `label` is
	// its accessible name, `handleLabel` the handle's (it has no visible text).
	type Props = {
		state: SheetState;
		onStateChange: (next: SheetState) => void;
		label: string;
		handleLabel: string;
		children: Snippet;
	};

	// Renamed: a local `state` would turn the $state rune into a store read.
	let { state: current, onStateChange, label, handleLabel, children }: Props = $props();

	let sheet: HTMLElement | undefined = $state();
	const modal = $derived(isSheetModal(current));
	const fade = $derived(motionFor(prefersReducedMotion.current) === 'fade');
	const place = placeWhileFading({ target: () => current, hidden: 'hidden', fade: () => fade });

	sheetKeyboard({
		sheet: () => sheet,
		kind: 'sheet',
		shown: () => current !== 'hidden',
		modal: () => modal,
		onEscape: () => onStateChange('hidden')
	});
</script>

<div class="layer">
	<Scrim opacity={sheetScrimOpacity(current)} onclick={() => onStateChange('hidden')} />
	<div
		bind:this={sheet}
		class="sheet"
		class:fade
		class:faded={current === 'hidden'}
		data-state={place.current}
		role="dialog"
		aria-modal={modal ? 'true' : undefined}
		aria-label={label}
		tabindex="-1"
		inert={current === 'hidden'}
		ontransitionend={place.onTransitionEnd}
	>
		<button
			type="button"
			class="handle"
			aria-label={handleLabel}
			aria-expanded={current === 'expanded'}
			onclick={() => onStateChange(toggledSheetState(current))}
		>
			<span class="bar"></span>
		</button>
		<div class="body">
			{@render children()}
		</div>
	</div>
</div>

<style>
	/*
	 * Fills the screen frame the sheet rests on. clip, not hidden: a hidden
	 * box still scrolls to show a focused control, which would lift the sheet.
	 */
	.layer {
		position: absolute;
		inset: 0;
		z-index: var(--z-sheet);
		overflow: clip;
		pointer-events: none;
	}

	/* Mobile README -> Region sheet: shell, states and 450ms --ease transform (D-FE3-1 geometry). */
	.sheet {
		position: absolute;
		inset-inline: 0;
		bottom: 0;
		display: flex;
		flex-direction: column;
		height: var(--sheet-height);
		border-radius: var(--radius-sheet) var(--radius-sheet) 0 0;
		background: var(--bg-surface);
		box-shadow: var(--shadow-sheet);
		pointer-events: auto;
		transition: transform var(--dur-sheet) var(--ease);
	}

	.sheet[data-state='peek'] {
		transform: translateY(var(--sheet-offset-peek));
	}

	.sheet[data-state='hidden'] {
		transform: translateY(var(--sheet-offset-hidden));
	}

	/* Accessibility: under reduced motion the slide becomes a fade. */
	.sheet.fade {
		transition: opacity var(--dur-sheet) var(--ease);
	}

	.sheet.fade.faded {
		opacity: 0;
	}

	/* "Handle area (padding 10px 0 6px, clickable): 40×4px bar, radius 2px, --border-chip." */
	.handle {
		position: relative;
		display: flex;
		flex: none;
		justify-content: center;
		width: 100%;
		padding: 10px 0 6px;
		border: 0;
		background: transparent;
		cursor: pointer;
	}

	.handle::before {
		content: '';
		position: absolute;
		inset: var(--hit-inset);
	}

	.bar {
		width: 40px;
		height: 4px;
		border-radius: 2px;
		background: var(--border-chip);
	}

	/* The sheet keeps its height; taller content scrolls here, below the handle. */
	.body {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		overscroll-behavior: contain;
	}
</style>
