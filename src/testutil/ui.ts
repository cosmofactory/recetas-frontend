import { afterEach, expect } from 'vitest';
import type { Component } from 'svelte';

// Browser-mode helpers for the FE-3 UI primitive specs (*.svelte.spec.ts).

// The design tokens and the layout tokens, as the root layout loads them. A
// glob, so a not-yet-written layout.css leaves its tokens unset (failing the
// assertions that need them) instead of failing every spec at import.
import.meta.glob(['../lib/styles/tokens.css', '../lib/styles/layout.css'], { eager: true });

type Loader = () => Promise<unknown>;

const uiModules: Record<string, Loader> = import.meta.glob('../lib/components/ui/*.svelte');
const harnessModules: Record<string, Loader> = import.meta.glob('./*Harness.svelte');
const uiLogicModules: Record<string, Loader> = import.meta.glob('../lib/ui/*.ts');

// A missing module (or one whose imports don't resolve yet) fails as an
// assertion naming the file, not as a collection error for the whole spec.
// The browser twin of load-export.ts, which needs node:path.
async function loadFrom<T>(loader: Loader | undefined, file: string, name: string): Promise<T> {
	let mod: Record<string, unknown> = {};
	let loadError = '';
	try {
		mod = ((await loader?.()) ?? {}) as Record<string, unknown>;
	} catch (err) {
		loadError = String(err);
	}
	expect(mod[name], `${file} must exist and export ${name} ${loadError}`).toBeDefined();
	return mod[name] as T;
}

export function loadUi<P extends Record<string, unknown>>(name: string): Promise<Component<P>> {
	const file = `../lib/components/ui/${name}.svelte`;
	return loadFrom(uiModules[file], `src/lib/components/ui/${name}.svelte`, 'default');
}

export function loadHarness<P extends Record<string, unknown>>(
	name: string
): Promise<Component<P>> {
	return loadFrom(harnessModules[`./${name}.svelte`], `src/testutil/${name}.svelte`, 'default');
}

// An export of a src/lib/ui module, e.g. loadUiExport('breakpoints.ts', 'desktopQuery').
export function loadUiExport<T>(file: string, name: string): Promise<T> {
	return loadFrom(uiLogicModules[`../lib/ui/${file}`], `src/lib/ui/${file}`, name);
}

const mounted: HTMLElement[] = [];
afterEach(() => mounted.splice(0).forEach((el) => el.remove()));

// A render target with room around it, so a hit area that extends past the
// visual box is not covered or clipped by anything else.
export function stage(style = 'padding: 40px'): HTMLElement {
	const el = document.createElement('div');
	el.setAttribute('style', style);
	document.body.append(el);
	mounted.push(el);
	return el;
}

// What `value` (e.g. "var(--accent)") computes to for a CSS property, so a
// component is compared against the token, not a copied literal. `base` sets
// what the property depends on (a border width needs a border style; it is
// also snapped to device pixels, so "1.5px" computes to "1px" at DPR 1).
export function computed(property: string, value: string, base = ''): string {
	const probe = stage(base);
	probe.style.setProperty(property, value);
	return getComputedStyle(probe).getPropertyValue(property);
}

export function style(el: Element, property: string): string {
	return getComputedStyle(el).getPropertyValue(property);
}

const MAX_REACH_PX = 60;

// Whether a pointer at (x, y) lands on the control (or something inside it).
export function hits(control: Element, x: number, y: number): boolean {
	const el = document.elementFromPoint(x, y);
	return el !== null && (el === control || control.contains(el));
}

function reach(control: Element, from: { x: number; y: number }, dx: number, dy: number): number {
	let distance = 0;
	while (
		distance < MAX_REACH_PX &&
		hits(control, from.x + dx * (distance + 1), from.y + dy * (distance + 1))
	) {
		distance++;
	}
	return distance;
}

// The area a pointer can actually hit, found with elementFromPoint along the
// axes through the control's centre. It counts pseudo-elements and padding
// alike, so it doesn't depend on how the hit area is extended.
export function hitArea(control: Element): { width: number; height: number } {
	const rect = control.getBoundingClientRect();
	const centre = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
	expect(hits(control, centre.x, centre.y), 'the control centre must be hittable').toBe(true);
	const width = reach(control, centre, -1, 0) + reach(control, centre, 1, 0) + 1;
	const height = reach(control, centre, 0, -1) + reach(control, centre, 0, 1) + 1;
	return { width, height };
}

const TRANSPARENT = 'rgba(0, 0, 0, 0)';

function isPainted(el: Element): boolean {
	const s = getComputedStyle(el);
	return parseFloat(s.borderTopWidth) > 0 || s.backgroundColor !== TRANSPARENT;
}

// The visual box: the control itself or its first descendant element that
// draws a border or a background. (A visual drawn only by a pseudo-element
// can't be measured, so the contract is that a real element paints it.)
export function paintedBox(control: Element): Element {
	const candidates = [control, ...control.querySelectorAll('*')];
	const painted = candidates.find(isPainted);
	expect(painted, 'got no element with a border or background').toBeDefined();
	return painted!;
}

// The duration the computed transition gives `property` ("all" counts).
export function transitionDuration(el: Element, property: string): string | undefined {
	const s = getComputedStyle(el);
	const properties = s.transitionProperty.split(',').map((p) => p.trim());
	const durations = s.transitionDuration.split(',').map((d) => d.trim());
	const index = properties.findIndex((p) => p === property || p === 'all');
	return index < 0 ? undefined : durations[index % durations.length];
}

function* styleRules(
	rules: CSSRuleList,
	inHoverMedia: boolean
): Generator<[CSSStyleRule, boolean]> {
	for (const rule of rules) {
		if (rule instanceof CSSStyleRule) yield [rule, inHoverMedia];
		if (!('cssRules' in rule)) continue;
		const hoverMedia =
			rule instanceof CSSMediaRule && /\(\s*hover\s*:\s*hover\s*\)/.test(rule.conditionText);
		yield* styleRules((rule as CSSGroupingRule).cssRules, inHoverMedia || hoverMedia);
	}
}

function selectsOnHover(rule: CSSStyleRule, el: Element): boolean {
	if (!rule.selectorText.includes(':hover')) return false;
	return rule.selectorText.split(',').some((part) => {
		const base = part.replaceAll(':hover', '').trim();
		return part.includes(':hover') && base !== '' && el.matches(base);
	});
}

// `:hover` rules that apply to `el` but sit outside `@media (hover: hover)`
// (desktop README: hover styles only where the device can hover).
export function ungatedHoverRules(el: Element): string[] {
	const all = [...document.styleSheets].flatMap((sheet) => [...styleRules(sheet.cssRules, false)]);
	return all
		.filter(([rule, gated]) => !gated && selectsOnHover(rule, el))
		.map(([rule]) => rule.selectorText);
}

// How many lines the control's text wraps onto (the most for any text node).
export function textLineCount(control: Element): number {
	const walker = document.createTreeWalker(control, NodeFilter.SHOW_TEXT);
	const range = document.createRange();
	let lines = 0;
	for (let node = walker.nextNode(); node; node = walker.nextNode()) {
		if (!node.textContent?.trim()) continue;
		range.selectNodeContents(node);
		lines = Math.max(lines, range.getClientRects().length);
	}
	return lines;
}

// The label renders in full: no ellipsis and no element whose content is
// wider than its box (which is what clipping or overflow: hidden would hide).
export function expectFullyVisible(control: HTMLElement, text: string) {
	expect(control.textContent?.trim(), 'got a different label').toBe(text);
	for (const el of [control, ...control.querySelectorAll<HTMLElement>('*')]) {
		expect(style(el, 'text-overflow'), `got text-overflow on <${el.tagName}>`).not.toBe('ellipsis');
		expect(el.scrollWidth, `got <${el.tagName}> content wider than its box`).toBeLessThanOrEqual(
			el.clientWidth + 1
		);
	}
}
