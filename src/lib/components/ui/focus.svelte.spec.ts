import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page, userEvent } from 'vitest/browser';
import { computed, loadUi, stage, style } from '../../../testutil/ui';

// FE-3 review: every primitive shows one shared focus ring for keyboard
// users (both READMEs -> Accessibility: every control must be reachable and
// operable by keyboard; stage FE-3 Acceptance -> Keyboard). It is drawn on
// :focus-visible only, so it appears after Tab and not after a mouse click,
// and its colour is the `--focus-ring` token from layout.css. All controls
// draw the same ring (style, width, offset, colour).

type Control = {
	name: string;
	component: string;
	props: Record<string, unknown>;
	role: 'button' | 'link' | 'tab';
	accessibleName: string;
};

const HREF = '#focus-ring';
const CONTROLS: Control[] = [
	{
		name: 'IconButton',
		component: 'IconButton',
		props: { icon: 'search', label: 'Search' },
		role: 'button',
		accessibleName: 'Search'
	},
	{
		name: 'Chip',
		component: 'Chip',
		props: { label: 'Vegetarian', pressed: false, onToggle: () => {} },
		role: 'button',
		accessibleName: 'Vegetarian'
	},
	{
		name: 'SegmentedSwitch tab',
		component: 'SegmentedSwitch',
		props: {
			options: [
				{ value: 'regional', label: 'Regional' },
				{ value: 'popular', label: 'Popular' }
			],
			value: 'regional',
			label: 'Browse'
		},
		role: 'tab',
		accessibleName: 'Regional'
	},
	...(['PrimaryButton', 'TextButton'] as const).flatMap((component): Control[] => [
		{
			name: `${component} <button>`,
			component,
			props: { label: 'Show results' },
			role: 'button',
			accessibleName: 'Show results'
		},
		{
			name: `${component} <a>`,
			component,
			props: { label: 'See all variations', href: HREF },
			role: 'link',
			accessibleName: 'See all variations'
		}
	])
];

type Ring = { style: string; width: string; offset: string; color: string };

function ringOf(el: Element): Ring {
	return {
		style: style(el, 'outline-style'),
		width: style(el, 'outline-width'),
		offset: style(el, 'outline-offset'),
		color: style(el, 'outline-color')
	};
}

// Renders the control after a plain button, so Tab moves focus onto it.
// Clicks never navigate (the link forms point at a fragment anyway).
async function renderControl(control: Control) {
	const Component = await loadUi<Record<string, unknown>>(control.component);
	const target = stage();
	target.addEventListener('click', (event) => event.preventDefault());
	const before = document.createElement('button');
	target.append(before);
	await render(Component, { target, props: control.props });
	const locator = page
		.elementLocator(target)
		.getByRole(control.role, { name: control.accessibleName, exact: true });
	await expect.element(locator).toBeInTheDocument();
	return { before, el: locator.element() as HTMLElement };
}

async function focusByKeyboard(control: Control): Promise<HTMLElement> {
	const { before, el } = await renderControl(control);
	before.focus();
	await userEvent.tab();
	expect(document.activeElement, `got Tab landing elsewhere than the ${control.name}`).toBe(el);
	return el;
}

describe('--focus-ring token', () => {
	it('is defined (layout.css)', () => {
		const value = getComputedStyle(document.documentElement).getPropertyValue('--focus-ring');
		expect(value.trim(), 'got no --focus-ring token').not.toBe('');
	});
});

describe('focus ring', () => {
	for (const control of CONTROLS) {
		it(`shows a --focus-ring outline on the ${control.name} after keyboard focus`, async () => {
			const el = await focusByKeyboard(control);
			const ring = ringOf(el);
			expect(ring.style, 'got no outline').not.toBe('none');
			expect(parseFloat(ring.width), `got outline width ${ring.width}`).toBeGreaterThan(0);
			const want = computed('outline-color', 'var(--focus-ring)', 'outline-style: solid');
			expect(ring.color, 'got an outline not in --focus-ring').toBe(want);
		});

		it(`shows no outline on the ${control.name} after a mouse click`, async () => {
			const { el } = await renderControl(control);
			await page.elementLocator(el).click();
			expect(document.activeElement, 'want the click to focus the control').toBe(el);
			const ring = ringOf(el);
			const hidden = ring.style === 'none' || parseFloat(ring.width) === 0;
			expect(hidden, `got an outline after a click: ${JSON.stringify(ring)}`).toBe(true);
		});
	}

	it('is the same ring on every control', async () => {
		const rings: Ring[] = [];
		for (const control of CONTROLS) rings.push(ringOf(await focusByKeyboard(control)));
		const distinct = new Set(rings.map((ring) => JSON.stringify(ring)));
		expect([...distinct], 'got different rings across the controls').toHaveLength(1);
	});
});
