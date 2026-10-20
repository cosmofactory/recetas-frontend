import { createRawSnippet, type Snippet } from 'svelte';
import { expect } from 'vitest';
import { stage } from './ui';

// Browser-mode helpers for the FE-3 container specs (Scrim, BottomSheet,
// OverlaySheet, StickyPanel). Containers take content as a `children`
// snippet; the specs pass plain HTML so they test the container alone.

export const CONTENT_TEST_ID = 'sheet-content';

// Three tabbable controls, so focus can be trapped and cycled.
export const CONTENT_HTML =
	`<div data-testid="${CONTENT_TEST_ID}">` +
	'<button type="button">First</button><a href="#second">Second</a>' +
	'<button type="button">Last</button></div>';

// A snippet rendering `html` (one root element), as a content component would.
export function content(html = CONTENT_HTML): Snippet {
	return createRawSnippet(() => ({ render: () => html }));
}

// A positioned frame covering the viewport, as the home screen is for its
// sheets: an absolutely or fixed positioned sheet rests on its bottom edge.
export function screenFrame(): HTMLElement {
	return stage('position: fixed; inset: 0; overflow: hidden');
}

// A plain button named `name`, appended to `parent` (focus before / after).
export function appendButton(parent: HTMLElement, name: string): HTMLButtonElement {
	const button = document.createElement('button');
	button.type = 'button';
	button.textContent = name;
	parent.append(button);
	return button;
}

// Jumps every running CSS transition or animation to its end, so geometry and
// opacity are read at the state's resting values, without waiting.
export function settle() {
	for (const animation of document.getAnimations()) animation.finish();
}

// The element whose accessible name is `label`, given as aria-label.
export function labelled(root: Element, label: string): HTMLElement {
	const el = root.querySelector<HTMLElement>(`[aria-label="${label}"]`);
	expect(el, `got no element with aria-label "${label}"`).not.toBeNull();
	return el!;
}

// How far the element's bottom edge sits below the frame's: the translateY a
// bottom-anchored sheet has moved down from its resting place.
export function belowRest(el: Element, frame: Element): number {
	return el.getBoundingClientRect().bottom - frame.getBoundingClientRect().bottom;
}

// The scrim that belongs with a sheet: the aria-hidden element in `root`
// outside the sheet.
export function scrimBeside(root: Element, sheet: Element): HTMLElement {
	const hidden = [...root.querySelectorAll<HTMLElement>('[aria-hidden="true"]')];
	const scrim = hidden.find((el) => !sheet.contains(el) && !el.contains(sheet));
	expect(scrim, 'got no aria-hidden scrim beside the sheet').toBeDefined();
	return scrim!;
}

// Whether a pointer at (x, y) lands on `el` or something inside it.
export function landsOn(el: Element, x: number, y: number): boolean {
	const hit = document.elementFromPoint(x, y);
	return hit !== null && (hit === el || el.contains(hit));
}

export function focusIsIn(el: Element): boolean {
	return document.activeElement !== null && el.contains(document.activeElement);
}

// Content with a control far below the fold of a peek sheet (about 560px
// down), so focusing it would scroll whatever can scroll.
export const DEEP_CONTENT_HTML =
	`<div data-testid="${CONTENT_TEST_ID}">` +
	'<div style="height: 560px"></div><button type="button">Deep</button></div>';

// Content far taller than any sheet: a control at the top and at the bottom.
export const TALL_CONTENT_HTML =
	`<div data-testid="${CONTENT_TEST_ID}">` +
	'<button type="button">First</button><div style="height: 1200px"></div>' +
	'<button type="button">Last</button></div>';

export function contentRoot(sheet: Element): HTMLElement {
	const root = sheet.querySelector<HTMLElement>(`[data-testid="${CONTENT_TEST_ID}"]`);
	expect(root, 'got no content inside the sheet').not.toBeNull();
	return root!;
}

// The scrollTop of `el` and every ancestor up to and including `root`, so
// any element that scrolled shows up as non-zero.
export function scrollTopsUpTo(el: Element, root: Element): number[] {
	const tops: number[] = [];
	for (let node: Element | null = el; node; node = node.parentElement) {
		tops.push(node.scrollTop);
		if (node === root) break;
	}
	return tops;
}

function scrollsVertically(el: Element): boolean {
	return ['auto', 'scroll'].includes(getComputedStyle(el).overflowY);
}

// The nearest element from `el` up to `container` (inclusive) that scrolls
// vertically: where the container lets its content scroll.
export function scrollerOf(el: Element, container: Element): HTMLElement {
	let node: Element | null = el;
	while (node && !scrollsVertically(node) && node !== container) node = node.parentElement;
	expect(node && scrollsVertically(node), 'got no vertical scroller in the container').toBe(true);
	return node as HTMLElement;
}

// Whether a CSS transition of `property` is running on `el` right now.
export function transitionRunning(el: Element, property: string): boolean {
	return el
		.getAnimations()
		.some(
			(animation) =>
				animation instanceof CSSTransition &&
				animation.transitionProperty === property &&
				animation.playState === 'running'
		);
}
