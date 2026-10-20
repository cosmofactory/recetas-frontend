import type { Component } from 'svelte';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import { computed, stage, style } from '../../../testutil/ui';

// FE-4 PR 2 review: one LanguageButton for both headers, with a `size` prop
// ('mobile' | 'desktop'); DesktopTopBar renders it instead of its own copy
// of the markup and styles (DesktopTopBar.svelte.spec.ts keeps pinning the
// bar's geometry). Values:
// - mobile (mobile README -> Header): "height 40px, padding 0 12px 0 14px,
//   pill, 1.5px --border-chip, 12px/700, letter-spacing .08em"; prototype
//   2a "gap:6px". 40px is the outer height, like the search IconButton.
// - desktop (prototype top bar l.68): "height:44px; padding:0 14px 0 16px;
//   border:1.5px solid rgba(43,30,22,.2); gap:7px; font-size:12.5px;
//   font-weight:700; letter-spacing:.08em", content-box (FE-3 review).
// Both: visible upper-case code, the localized label as visually hidden
// text, aria-expanded / aria-controls from the props.

type Props = {
	code: string;
	label: string;
	expanded: boolean;
	controls?: string;
	size?: 'mobile' | 'desktop';
};

// Where the component lives is the writer's choice (ui/ or home/).
const modules = import.meta.glob<{ default: Component<Props> }>(
	'../{ui,home}/LanguageButton.svelte'
);

async function renderButton(props: Partial<Props> = {}): Promise<HTMLElement> {
	const load = Object.values(modules)[0];
	expect(load, 'want LanguageButton.svelte in src/lib/components/ui or /home').toBeDefined();
	const LanguageButton = (await load()).default;
	const all: Props = { code: 'en', label: 'Language', expanded: false, ...props };
	await render(LanguageButton, { target: stage(), props: all });
	return page.getByRole('button', { name: /Language/ }).element() as HTMLElement;
}

const SOLID = 'border-style: solid';

describe('LanguageButton', () => {
	it('shows the upper-case code and is named with the label', async () => {
		const button = await renderButton({ size: 'mobile' });
		expect(button.textContent).toContain('EN');
		expect(button.getAttribute('aria-expanded')).toBe('false');
	});

	it('size="mobile": 40px outer, padding 14/12, 12px, gap 6px, --border-chip', async () => {
		const button = await renderButton({ size: 'mobile' });
		expect(button.getBoundingClientRect().height).toBe(40);
		expect(style(button, 'padding-left')).toBe('14px');
		expect(style(button, 'padding-right')).toBe('12px');
		expect(style(button, 'font-size')).toBe('12px');
		expect(style(button, 'column-gap')).toBe('6px');
		const chip = computed('border-top-color', 'var(--border-chip)');
		expect(style(button, 'border-top-color')).toBe(chip);
	});

	it('size="desktop": 44px content-box, padding 16/14, 12.5px, gap 7px', async () => {
		const button = await renderButton({ size: 'desktop' });
		expect(style(button, 'box-sizing')).toBe('content-box');
		expect(style(button, 'height')).toBe('44px');
		expect(style(button, 'padding-left')).toBe('16px');
		expect(style(button, 'padding-right')).toBe('14px');
		expect(style(button, 'font-size')).toBe('12.5px');
		expect(style(button, 'column-gap')).toBe('7px');
		const border = computed('border-top-color', 'var(--border-language-button)');
		expect(style(button, 'border-top-color')).toBe(border);
	});

	for (const size of ['mobile', 'desktop'] as const) {
		it(`size="${size}": 700, .08em tracking, a 1.5px pill border`, async () => {
			const button = await renderButton({ size });
			const fontSize = parseFloat(style(button, 'font-size'));
			expect(style(button, 'font-weight')).toBe('700');
			expect(parseFloat(style(button, 'letter-spacing'))).toBeCloseTo(0.08 * fontSize, 2);
			expect(style(button, 'border-top-width')).toBe(computed('border-top-width', '1.5px', SOLID));
			expect(parseFloat(style(button, 'border-top-left-radius'))).toBeGreaterThanOrEqual(20);
		});
	}
});

// The bar's source, to check it renders the shared button.
const barSource = import.meta.glob<string>('./DesktopTopBar.svelte', {
	query: '?raw',
	import: 'default',
	eager: true
});

describe('DesktopTopBar uses LanguageButton', () => {
	const source = Object.values(barSource)[0] ?? '';

	it('imports LanguageButton.svelte and renders it with size="desktop"', () => {
		expect(source, 'want an import of LanguageButton.svelte').toMatch(
			/import\s+LanguageButton\s+from\s+'[^']*LanguageButton\.svelte'/
		);
		expect(source, 'want <LanguageButton … size="desktop">').toMatch(
			/<LanguageButton\b[^>]*\bsize="desktop"/
		);
	});

	it('has no copy of the button markup or styles of its own', () => {
		expect(source, 'got a .language-button rule in DesktopTopBar').not.toMatch(
			/\.language-button\b/
		);
		expect(source, 'got its own aria-expanded button').not.toMatch(/aria-expanded=/);
	});
});
