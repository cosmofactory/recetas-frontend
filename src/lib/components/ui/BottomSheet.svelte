<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { placeWhileFading } from '#lib/ui/fade-out.svelte.ts';
	import { motionFor, prefersReducedMotion } from '#lib/ui/motion.svelte.ts';
	import { sheetKeyboard } from '#lib/ui/sheet-keyboard.svelte.ts';
	import { SheetDrag } from '#lib/ui/sheet-pointer-drag.svelte.ts';
	import {
		isSheetModal,
		sheetScrimOpacity,
		toggledSheetState,
		type SheetState
	} from '#lib/ui/sheet.ts';
	import { scrollToTopOn } from '#lib/ui/scroll-reset.svelte.ts';
	import Scrim from './Scrim.svelte';
	import SheetHandle from './SheetHandle.svelte';

	// The mobile container (F6) for the region and dish sheets, controlled: it
	// shows `state` and asks for a new one through onStateChange. `label` is
	// its accessible name, `handleLabel` the handle's (it has no visible text).
	// A new `contentKey` (other content, e.g. another region) scrolls the
	// body back to the top. `opener` is the control that opened it, when the
	// screen knows; focus returns there once hidden. The handle, content
	// marked data-sheet-drag and, in peek, the whole sheet drag it (D-FE9-1);
	// a drag's release asks through onStateChange too.
	type Props = {
		state: SheetState;
		onStateChange: (next: SheetState) => void;
		label: string;
		handleLabel: string;
		contentKey?: unknown;
		opener?: () => HTMLElement | undefined;
		children: Snippet;
	};

	// Renamed: a local `state` would turn the $state rune into a store read.
	let {
		state: current,
		onStateChange,
		label,
		handleLabel,
		contentKey,
		opener,
		children
	}: Props = $props();

	let sheet: HTMLElement | undefined = $state();
	let body: HTMLElement | undefined = $state();
	scrollToTopOn(
		() => contentKey,
		() => body
	);
	const modal = $derived(isSheetModal(current));
	const fade = $derived(motionFor(prefersReducedMotion.current) === 'fade');
	const place = placeWhileFading<SheetState>({
		target: () => current,
		hidden: 'hidden',
		fade: () => fade
	});
	const drag = new SheetDrag({
		state: () => current,
		place: () => place.current,
		contentKey: () => contentKey,
		request: (next) => onStateChange(next)
	});
	$effect(() => drag.settleHeld());
	const dragTransform = $derived(
		drag.offset === undefined ? undefined : `translateY(${drag.offset}px)`
	);
	// Until hydrated nothing drags, so the content keeps the browser's own
	// touch scrolling and text selection.
	let dragReady = $state(false);
	onMount(() => {
		dragReady = true;
	});

	sheetKeyboard({
		sheet: () => sheet,
		kind: 'sheet',
		shown: () => current !== 'hidden',
		modal: () => modal,
		onEscape: () => onStateChange('hidden'),
		opener: () => opener?.()
	});
</script>

<div class="layer" class:shown={current !== 'hidden'}>
	<Scrim opacity={sheetScrimOpacity(current)} onclick={() => onStateChange('hidden')} />
	<div
		bind:this={sheet}
		class="sheet"
		class:fade
		class:faded={current === 'hidden'}
		class:peek={current === 'peek'}
		class:dragging={drag.dragging}
		class:drag-ready={dragReady}
		style:transform={dragTransform}
		data-state={place.current}
		role="dialog"
		aria-modal={modal ? 'true' : undefined}
		aria-label={label}
		tabindex="-1"
		inert={current === 'hidden'}
		ontransitionend={place.onTransitionEnd}
		onpointerdown={drag.start}
		onpointermove={drag.move}
		onpointerup={drag.end}
		onpointercancel={drag.cancel}
		onclickcapture={drag.clickAfterDrag}
		ondragstart={drag.preventNativeDrag}
	>
		<SheetHandle
			label={handleLabel}
			expanded={current === 'expanded'}
			onclick={() => onStateChange(toggledSheetState(current))}
		/>
		<div class="body" bind:this={body}>
			{@render children()}
		</div>
	</div>
</div>

<style>
	/*
	 * Fills the screen frame the sheet rests on. clip, not hidden: a hidden
	 * box still scrolls to show a focused control, which would lift the sheet.
	 * Once hidden and at rest it paints nothing over the frame (so axe can
	 * read the page's contrast): visibility turns hidden only after the slide
	 * or fade (both --dur-sheet), and visible at once when shown.
	 */
	.layer {
		position: absolute;
		inset: 0;
		z-index: var(--z-sheet);
		overflow: clip;
		pointer-events: none;
		visibility: hidden;
		transition: visibility 0s var(--dur-sheet);
	}

	.layer.shown {
		visibility: visible;
		transition-delay: 0s;
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

	/* D-FE9-1: while dragged the sheet follows the pointer, with no transition. */
	.sheet.dragging {
		transition: none;
	}

	/*
	 * Once hydrated, drag zones (the handle is one) get the pointer's travel
	 * instead of scrolling (pinch zoom stays) or selecting text; in peek the
	 * content is one too, so it never scrolls there (FB-5: a swipe up expands
	 * first).
	 */
	.sheet.drag-ready :global([data-sheet-drag]),
	.sheet.drag-ready.peek .body {
		touch-action: pinch-zoom;
		-webkit-user-select: none;
		user-select: none;
	}

	/* The sheet keeps its height; taller content scrolls here, below the handle. */
	.body {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		overscroll-behavior: contain;
		padding-bottom: var(--sheet-end-inset);
		transition: padding-bottom var(--dur-sheet) var(--ease);
	}

	/* Hidden keeps the peek padding, so hiding a scrolled peek doesn't snap its content. */
	.sheet:not([data-state='expanded']) .body {
		padding-bottom: var(--sheet-end-inset-peek);
	}

	.sheet.fade .body {
		transition: none;
	}
</style>
