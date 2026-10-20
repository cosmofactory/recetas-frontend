<script lang="ts">
	import type { Snippet } from 'svelte';
	import { placeWhileFading } from '#lib/ui/fade-out.svelte.ts';
	import { motionFor, prefersReducedMotion } from '#lib/ui/motion.svelte.ts';
	import { sheetKeyboard } from '#lib/ui/sheet-keyboard.svelte.ts';
	import Scrim from './Scrim.svelte';

	// The Filters sheet's container, above the home sheet; controlled: `open`
	// shows it, onClose asks to close it (scrim tap, Escape). It is modal
	// whenever open.
	type Props = {
		open: boolean;
		onClose: () => void;
		label: string;
		children: Snippet;
	};

	let { open, onClose, label, children }: Props = $props();

	let sheet: HTMLElement | undefined = $state();
	const fade = $derived(motionFor(prefersReducedMotion.current) === 'fade');
	const raised = placeWhileFading({ target: () => open, hidden: false, fade: () => fade });

	sheetKeyboard({
		sheet: () => sheet,
		kind: 'overlay',
		shown: () => open,
		modal: () => open,
		onEscape: () => onClose()
	});
</script>

<div class="layer">
	<Scrim variant="filter" opacity={open ? 1 : 0} onclick={onClose} />
	<div
		bind:this={sheet}
		class="sheet"
		class:raised={raised.current}
		class:fade
		class:faded={!open}
		role="dialog"
		aria-modal={open ? 'true' : undefined}
		aria-label={label}
		tabindex="-1"
		inert={!open}
		ontransitionend={raised.onTransitionEnd}
	>
		{@render children()}
	</div>
</div>

<style>
	/* clip, not hidden: a hidden box still scrolls to show a focused control. */
	.layer {
		position: absolute;
		inset: 0;
		z-index: var(--z-overlay);
		overflow: clip;
		pointer-events: none;
	}

	/*
	 * Mobile README -> Filters sheet: "Bg --bg-surface, top radius 24px, shadow
	 * --shadow-filter-sheet, padding 12px 20px 22px, column gap 14px. Hidden:
	 * translateY(110%); open: 0; 400ms --ease." Capped at the screen's height
	 * (a landscape phone), scrolling inside.
	 */
	.sheet {
		position: absolute;
		inset-inline: 0;
		bottom: 0;
		display: flex;
		flex-direction: column;
		gap: 14px;
		max-height: 100%;
		overflow-y: auto;
		overscroll-behavior: contain;
		padding: 12px 20px 22px;
		border-radius: var(--radius-filter-sheet) var(--radius-filter-sheet) 0 0;
		background: var(--bg-surface);
		box-shadow: var(--shadow-filter-sheet);
		pointer-events: auto;
		transform: translateY(110%);
		transition: transform var(--dur-filter) var(--ease);
	}

	.sheet.raised {
		transform: none;
	}

	/* Accessibility: under reduced motion the slide becomes a fade. */
	.sheet.fade {
		transition: opacity var(--dur-filter) var(--ease);
	}

	.sheet.fade.faded {
		opacity: 0;
	}
</style>
