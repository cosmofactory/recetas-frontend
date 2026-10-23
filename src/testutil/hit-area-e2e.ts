import type { Page } from '@playwright/test';
import { evaluateWith } from './in-page-e2e';

// The global 44px check (FE-8 Accessibility, both READMEs -> Accessibility:
// "All tap targets ≥ 44px tall in real build (chips may be 34px tall
// visually; extend the hit area)"; layout.css --hit-min). A target's hit
// area is what a press can land on:
// - its border box, grown by an absolutely positioned ::before / ::after
//   (the app's `inset: var(--hit-inset)` pattern, CLAUDE.md UI primitives),
//   whose insets resolve against the padding box;
// - for a map region (a link spanning the whole map whose cells alone take
//   pointer events, FE-4), the bounding box of its cells plus its invisible
//   `.hit-extension` below the map (a bottom-row region, FE-8 PR 5a), each
//   piece dropped if a press at its centre lands on another region or on
//   the bare map (the gaps between cells take no press, so a centre line
//   would understate a region); the extension must not overlap another region's cells or
//   extension;
// - cut to any clipping ancestor (overflow other than visible) it sits in;
// - then, for a target on screen, what a press really reaches: along the
//   lines through the box's centre, the run of points where
//   elementFromPoint lands on the target or inside it (a neighbour painted
//   over its ::before takes those points). A target whose centre is covered
//   (by a scrim, an open sheet or overlay) isn't pressable in that state, and
//   it and one partly off screen keep the geometric measure.
// The one documented exception, stage FE-3 -> Acceptance (2026-10-20): a
// chip (a toggle button) in a wrapping row extends only half the row gap
// above and below, so its height must be its border box plus the row gap.

export const HIT_MIN_PX = 44;
// Sub-pixel layout (fractional clamps, 1.5px borders) and the press
// sampling: elementFromPoint at a fractional edge can go either way, so a
// sampled run reads up to about 0.75px short of the painted box.
const TOLERANCE_PX = 1;

// Everything a press or a keyboard can operate.
const INTERACTIVE = [
	'a[href]',
	'button',
	'input:not([type="hidden"])',
	'select',
	'textarea',
	'summary',
	'[role="button"]',
	'[role="link"]',
	'[role="tab"]',
	'[role="menuitem"]',
	'[role="option"]',
	'[role="checkbox"]',
	'[role="switch"]',
	'[tabindex]:not([tabindex="-1"])'
].join(', ');

export type Undersized = { target: string; width: number; height: number; want: string };

type Box = { left: number; top: number; right: number; bottom: number };

function boxOfRect(rect: DOMRect): Box {
	return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
}

function union(a: Box, b: Box): Box {
	return {
		left: Math.min(a.left, b.left),
		top: Math.min(a.top, b.top),
		right: Math.max(a.right, b.right),
		bottom: Math.max(a.bottom, b.bottom)
	};
}

function paddingBox(el: Element): Box {
	const rect = el.getBoundingClientRect();
	const s = getComputedStyle(el);
	return {
		left: rect.left + parseFloat(s.borderLeftWidth),
		top: rect.top + parseFloat(s.borderTopWidth),
		right: rect.right - parseFloat(s.borderRightWidth),
		bottom: rect.bottom - parseFloat(s.borderBottomWidth)
	};
}

// The box of an absolutely positioned ::before / ::after, or null.
function pseudoBox(el: Element, pseudo: string): Box | null {
	const s = getComputedStyle(el, pseudo);
	if (s.content === 'none' || s.position !== 'absolute' || s.pointerEvents === 'none') return null;
	const inside = paddingBox(el);
	return {
		left: inside.left + parseFloat(s.left),
		top: inside.top + parseFloat(s.top),
		right: inside.right - parseFloat(s.right),
		bottom: inside.bottom - parseFloat(s.bottom)
	};
}

// What of a map region takes a press: its cells and its hit extension.
function mapPieces(el: Element): Box[] {
	const pieces = [...el.querySelectorAll('[data-map-cell], .hit-extension')];
	return pieces.map((piece) => boxOfRect(piece.getBoundingClientRect()));
}

function cellsBox(el: Element): Box | null {
	if (!el.querySelector('[data-map-cell]')) return null;
	return mapPieces(el).reduce(union);
}

function intersects(a: Box, b: Box): boolean {
	return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

// A map region whose hit extension lands on another region's target.
function mapOverlap(el: Element, all: Element[]): Undersized | null {
	const extensions = [...el.querySelectorAll('.hit-extension')].map((x) =>
		boxOfRect(x.getBoundingClientRect())
	);
	const other = all.find(
		(region) =>
			region !== el &&
			mapPieces(region).some((piece) => extensions.some((x) => intersects(x, piece)))
	);
	if (!other) return null;
	return {
		target: targetName(el),
		width: 0,
		height: 0,
		want: `no overlap with ${targetName(other)}`
	};
}

function mapOverlaps(): Undersized[] {
	const regions = [...document.querySelectorAll('a[href]')].filter((a) =>
		a.querySelector('[data-map-cell]')
	);
	return regions.map((el) => mapOverlap(el, regions)).filter((found) => found !== null);
}

function ownHitBox(el: Element): Box {
	const cells = cellsBox(el);
	if (cells) return cells;
	const pseudos = ['::before', '::after']
		.map((p) => pseudoBox(el, p))
		.filter((b): b is Box => b !== null);
	return pseudos.reduce(union, boxOfRect(el.getBoundingClientRect()));
}

function clipsOn(el: Element, axis: 'x' | 'y'): boolean {
	const overflow = getComputedStyle(el)[axis === 'x' ? 'overflowX' : 'overflowY'];
	return overflow !== 'visible';
}

function restsInside(own: DOMRect, clip: Box): boolean {
	return (
		own.left >= clip.left &&
		own.right <= clip.right &&
		own.top >= clip.top &&
		own.bottom <= clip.bottom
	);
}

function clipBy(box: Box, clip: Box, clipper: Element): Box {
	let result = box;
	if (clipsOn(clipper, 'x'))
		result = {
			...result,
			left: Math.max(result.left, clip.left),
			right: Math.min(result.right, clip.right)
		};
	if (clipsOn(clipper, 'y'))
		result = {
			...result,
			top: Math.max(result.top, clip.top),
			bottom: Math.min(result.bottom, clip.bottom)
		};
	return result;
}

// Cut to the clipping ancestors the target rests inside (one it is scrolled
// out of is a scroller whose content moves, not a clip of its hit area).
function clipped(el: Element, box: Box): Box {
	const own = el.getBoundingClientRect();
	let result = box;
	for (let up = el.parentElement; up; up = up.parentElement) {
		const clip = paddingBox(up);
		if (restsInside(own, clip)) result = clipBy(result, clip, up);
	}
	return result;
}

// The FE-3 exception: a chip in a wrapping row needs its height plus the row gap.
function wantedHeight(el: Element, min: number): number {
	const row = el.parentElement;
	const isChip = el.matches('button[aria-pressed]');
	if (!row || !isChip || getComputedStyle(row).flexWrap !== 'wrap') return min;
	const gap = parseFloat(getComputedStyle(row).rowGap) || 0;
	return Math.min(min, el.getBoundingClientRect().height + gap);
}

function isTarget(el: Element): boolean {
	if (el.closest('[inert]') || el.matches(':disabled')) return false;
	if (!el.checkVisibility({ visibilityProperty: true, opacityProperty: true })) return false;
	const rect = el.getBoundingClientRect();
	// A 1px box is visually hidden text (.visually-hidden), not something to press.
	return rect.width > 1 && rect.height > 1;
}

function targetName(el: Element): string {
	const role = el.getAttribute('role') ?? el.tagName.toLowerCase();
	const name = (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().replace(/\s+/g, ' ');
	const href = el.getAttribute('href');
	return `<${el.tagName.toLowerCase()}> ${role} "${name.slice(0, 40)}"${href ? ` ${href}` : ''}`;
}

function lands(el: Element, x: number, y: number): boolean {
	const hit = document.elementFromPoint(x, y);
	return hit !== null && (hit === el || el.contains(hit));
}

function onScreen(box: Box): boolean {
	return box.left >= 0 && box.top >= 0 && box.right <= innerWidth && box.bottom <= innerHeight;
}

// Sampling step of the press reach, in px (in-page code can't see a module constant).
function reachStep(): number {
	return 0.25;
}

type Ray = { x: number; y: number; dx: number; dy: number; limit: number };

// How far along the ray, within its limit, presses keep landing on the
// target (short by under a step).
function reachAlong(el: Element, ray: Ray): number {
	const step = reachStep();
	let distance = 0;
	const next = () => distance + step;
	while (next() <= ray.limit && lands(el, ray.x + ray.dx * next(), ray.y + ray.dy * next()))
		distance = next();
	return distance;
}

type Size = { width: number; height: number };

function sizeOf(box: Box): Size {
	return { width: box.right - box.left, height: box.bottom - box.top };
}

// A piece of a map region is lost when a press at its centre lands elsewhere
// on the map (another region, or the map itself: an extension that takes no
// press). Landing outside the map means an overlay covers it in this state.
function pieceLost(el: Element, piece: Box): boolean {
	const hit = document.elementFromPoint(
		(piece.left + piece.right) / 2,
		(piece.top + piece.bottom) / 2
	);
	if (!hit || hit === el || el.contains(hit)) return false;
	return hit.closest('[data-testid="region-map"]') !== null;
}

// A map region: the bounding box of the pieces a press can reach.
function mapPressableSize(el: Element, box: Box): Size {
	if (!onScreen(box)) return sizeOf(box);
	const kept = mapPieces(el).filter((piece) => !pieceLost(el, piece));
	return kept.length === 0 ? { width: 0, height: 0 } : sizeOf(kept.reduce(union));
}

// The pressable size along the centre lines, or the geometry when it can't be sampled.
function pressableSize(el: Element, box: Box): Size {
	if (el.querySelector('[data-map-cell]')) return mapPressableSize(el, box);
	const geometric = sizeOf(box);
	const centre = { x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2 };
	if (!onScreen(box) || !lands(el, centre.x, centre.y)) return geometric;
	// Both ways from the centre, plus the sampled centre point's own step.
	const across = (dx: number, dy: number, limit: number) =>
		reachAlong(el, { ...centre, dx, dy, limit }) +
		reachAlong(el, { ...centre, dx: -dx, dy: -dy, limit }) +
		reachStep();
	return { width: across(1, 0, geometric.width / 2), height: across(0, 1, geometric.height / 2) };
}

function measure(el: Element, min: number, tolerance: number): Undersized | null {
	const { width, height } = pressableSize(el, clipped(el, ownHitBox(el)));
	const minHeight = wantedHeight(el, min);
	if (width >= min - tolerance && height >= minHeight - tolerance) return null;
	const round = (n: number) => Math.round(n * 10) / 10;
	const want = `≥ ${min}×${round(minHeight)}`;
	return { target: targetName(el), width: round(width), height: round(height), want };
}

function undersized(arg: { selector: string; min: number; tolerance: number }): Undersized[] {
	return [...document.querySelectorAll(arg.selector)]
		.filter(isTarget)
		.map((el) => measure(el, arg.min, arg.tolerance))
		.filter((found) => found !== null)
		.concat(mapOverlaps());
}

const IN_PAGE_HELPERS = [
	boxOfRect,
	union,
	paddingBox,
	pseudoBox,
	mapPieces,
	cellsBox,
	intersects,
	mapOverlap,
	mapOverlaps,
	ownHitBox,
	clipsOn,
	restsInside,
	clipBy,
	clipped,
	wantedHeight,
	isTarget,
	targetName,
	lands,
	onScreen,
	reachStep,
	reachAlong,
	sizeOf,
	pieceLost,
	mapPressableSize,
	pressableSize,
	measure
];

// Every visible, enabled interactive element whose hit area is under 44×44.
export function undersizedTargets(page: Page): Promise<Undersized[]> {
	const arg = { selector: INTERACTIVE, min: HIT_MIN_PX, tolerance: TOLERANCE_PX };
	return evaluateWith(page, undersized, IN_PAGE_HELPERS, arg);
}

export function describeUndersized(found: Undersized[]): string {
	return found.map((t) => `${t.target}: got ${t.width}×${t.height}, want ${t.want}`).join('\n');
}
