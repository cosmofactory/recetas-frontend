import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page, userEvent } from 'vitest/browser';
import {
	computed,
	expectFullyVisible,
	hitArea,
	loadUi,
	stage,
	style,
	ungatedHoverRules
} from '../../../testutil/ui';

// FE-3 PrimaryButton and TextButton. Mobile README -> Dish detail sheet:
// Primary "See all variations" — "accent bg, `--on-accent` text, radius 14px,
// padding 15px, 14px/600, hover `--accent-hover`"; the Filters sheet's "Show
// results" is the same primary. TextButton is the accent text action ("Clear
// all" (12px/600, accent), search "Cancel" (14px/600, accent)); the README
// gives two sizes, so only colour and shape are pinned here.
//
// Both render a link when given an href (navigation, e.g. to the Variations
// page) and a type="button" <button> otherwise. Hover styles apply only
// under `(hover: hover)` (stage FE-3 -> Desktop); tap targets are ≥ 44px tall
// (Accessibility). Labels never truncate (Localization -> Length).

type ButtonProps = {
	label: string;
	href?: string;
	onclick?: (event: MouseEvent) => void;
	// PrimaryButton only.
	size?: 'regular' | 'compact';
};

const LABEL = 'See all variations';
const HREF = '/en/dishes/tortilla';
const HIT_MIN_PX = 44;
const TRANSPARENT = 'rgba(0, 0, 0, 0)';
const KINDS = ['PrimaryButton', 'TextButton'] as const;
// A long label in a narrow box: es "Ver todas las variantes" in 200px.
const LONG_LABEL = 'Ver todas las variantes';
const NARROW = 'width: 200px; padding: 40px';

async function renderButton(kind: string, props: Partial<ButtonProps> = {}, target = stage()) {
	const Button = await loadUi<ButtonProps>(kind);
	const all: ButtonProps = { label: LABEL, ...props };
	await render(Button, { target, props: all });
	const role = all.href ? 'link' : 'button';
	const control = page.getByRole(role, { name: all.label, exact: true });
	await expect.element(control).toBeInTheDocument();
	return control.element() as HTMLElement;
}

for (const kind of KINDS) {
	describe(`${kind} element`, () => {
		it('renders a type="button" <button> with the label when there is no href', async () => {
			const button = await renderButton(kind);
			expect(button.tagName).toBe('BUTTON');
			expect(button.getAttribute('type')).toBe('button');
			expect(button.textContent?.trim()).toBe(LABEL);
		});

		it('calls onclick when the button is clicked', async () => {
			const onclick = vi.fn();
			await page.elementLocator(await renderButton(kind, { onclick })).click();
			expect(onclick, 'want one onclick call').toHaveBeenCalledTimes(1);
		});

		it('renders an <a href> (and no <button>) when given an href', async () => {
			const target = stage();
			const link = await renderButton(kind, { href: HREF }, target);
			expect(link.tagName).toBe('A');
			expect(link.getAttribute('href')).toBe(HREF);
			expect(target.querySelector('button'), 'got a <button> inside the link').toBeNull();
		});
	});

	describe(`${kind} fit`, () => {
		for (const href of [undefined, HREF]) {
			it(`answers pointer hits at least ${HIT_MIN_PX}px tall as ${href ? 'a link' : 'a button'}`, async () => {
				const { height } = hitArea(await renderButton(kind, { href }));
				expect(height, `got hit height ${height}`).toBeGreaterThanOrEqual(HIT_MIN_PX);
			});
		}

		it('shows a long label in full in a narrow box (it may wrap, never clip)', async () => {
			const button = await renderButton(kind, { label: LONG_LABEL }, stage(NARROW));
			expectFullyVisible(button, LONG_LABEL);
		});

		it('styles :hover only under @media (hover: hover)', async () => {
			const button = await renderButton(kind);
			const link = await renderButton(kind, { label: LONG_LABEL, href: HREF });
			const rules = [button, link].flatMap(ungatedHoverRules);
			expect(rules, `got ungated :hover rules ${JSON.stringify(rules)}`).toEqual([]);
		});
	});
}

// Owner decision (match the prototype): the Filters sheet's "Show results"
// is a compact primary. design/Asadorov Explorations.dc.html lines 223 and
// 349: "border-radius:13px;padding:14px;...font-weight:600;font-size:13.5px";
// "See all variations" (line 374) stays regular: "border-radius:14px;
// padding:15px;...font-size:14px". The 13px radius is the layout.css token
// --radius-button-compact.
describe('PrimaryButton sizes', () => {
	const PRIMARY_PROPS = ['border-top-left-radius', 'padding', 'font-size', 'font-weight'];
	const sizes: { size?: 'regular' | 'compact'; name: string; want: () => string[] }[] = [
		{
			name: 'default (regular)',
			want: () => [
				computed('border-top-left-radius', 'var(--radius-button)'),
				'15px',
				'14px',
				'600'
			]
		},
		{
			size: 'regular',
			name: 'regular',
			want: () => [
				computed('border-top-left-radius', 'var(--radius-button)'),
				'15px',
				'14px',
				'600'
			]
		},
		{
			size: 'compact',
			name: 'compact',
			want: () => [
				computed('border-top-left-radius', 'var(--radius-button-compact)'),
				'14px',
				'13.5px',
				'600'
			]
		}
	];
	for (const { size, name, want } of sizes) {
		for (const href of [undefined, HREF]) {
			it(`${name}: radius, padding and type follow the prototype as ${href ? 'a link' : 'a button'}`, async () => {
				const button = await renderButton('PrimaryButton', { size, href });
				expect(PRIMARY_PROPS.map((p) => style(button, p))).toEqual(want());
			});
		}
	}

	it('compact: --radius-button-compact resolves to 13px', () => {
		expect(computed('border-top-left-radius', 'var(--radius-button-compact)')).toBe('13px');
	});

	// The compact visual is about 43px tall, so the hit extension must cover it.
	for (const href of [undefined, HREF]) {
		it(`compact: answers pointer hits at least ${HIT_MIN_PX}px tall as ${href ? 'a link' : 'a button'}`, async () => {
			const { height } = hitArea(await renderButton('PrimaryButton', { size: 'compact', href }));
			expect(height, `got hit height ${height}`).toBeGreaterThanOrEqual(HIT_MIN_PX);
		});
	}

	it('compact: stays accent with --on-accent text', async () => {
		const button = await renderButton('PrimaryButton', { size: 'compact' });
		expect(style(button, 'background-color')).toBe(computed('background-color', 'var(--accent)'));
		expect(style(button, 'color')).toBe(computed('color', 'var(--on-accent)'));
	});
});

describe('PrimaryButton look', () => {
	// "accent bg, `--on-accent` text, radius 14px, padding 15px, 14px/600".
	for (const href of [undefined, HREF]) {
		it(`is accent with --on-accent 14px/600 text, radius 14px, padding 15px as ${href ? 'a link' : 'a button'}`, async () => {
			const button = await renderButton('PrimaryButton', { href });
			const got = [
				'background-color',
				'color',
				'border-top-left-radius',
				'padding',
				'font-size',
				'font-weight'
			].map((p) => style(button, p));
			expect(got).toEqual([
				computed('background-color', 'var(--accent)'),
				computed('color', 'var(--on-accent)'),
				computed('border-top-left-radius', 'var(--radius-button)'),
				'15px',
				'14px',
				'600'
			]);
		});
	}

	it('has no underline as a link', async () => {
		const link = await renderButton('PrimaryButton', { href: HREF });
		expect(style(link, 'text-decoration-line')).toBe('none');
	});

	// "hover `--accent-hover`" (headless Chromium matches (hover: hover)).
	it('turns --accent-hover on hover', async () => {
		const button = await renderButton('PrimaryButton');
		await userEvent.hover(button);
		const want = computed('background-color', 'var(--accent-hover)');
		await expect.poll(() => style(button, 'background-color')).toBe(want);
	});
});

describe('TextButton look', () => {
	for (const href of [undefined, HREF]) {
		it(`is accent text with no background or border as ${href ? 'a link' : 'a button'}`, async () => {
			const button = await renderButton('TextButton', { href });
			expect(style(button, 'color')).toBe(computed('color', 'var(--accent)'));
			expect(style(button, 'background-color')).toBe(TRANSPARENT);
			expect(style(button, 'border-top-width')).toBe('0px');
		});
	}
});
