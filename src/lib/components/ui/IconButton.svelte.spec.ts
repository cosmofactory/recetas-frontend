import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import {
	computed,
	hitArea,
	loadUi,
	paintedBox,
	stage,
	style,
	ungatedHoverRules
} from '../../../testutil/ui';

// FE-3 IconButton: the header's round icon control. Mobile README -> Header:
// "Search button — 40×40 circle, 1.5px border `--border-chip`, magnifier icon
// in ink (use your icon set; 15px)". Both READMEs -> Accessibility: "All tap
// targets ≥ 44px tall in real build ... extend the hit area". Icons come from
// @lucide/svelte (stack.md F5), chosen by name from the fixed set the READMEs
// list under Assets: "magnifier, back chevron, close ×, check ✓". The icon has
// no text, so the caller passes the accessible name (a Paraglide message).

type IconName = 'search' | 'back' | 'close' | 'check';
type IconButtonProps = { icon: IconName; label: string; onclick?: (event: MouseEvent) => void };

const LABEL = 'Search';
const VISUAL_PX = 40;
const HIT_MIN_PX = 44;
const ICON_PX = 15;
const SOLID = 'border-style: solid';

// Lucide renders <svg class="lucide-icon lucide lucide-<kebab-name>">.
const ICONS: { icon: IconName; lucide: string }[] = [
	{ icon: 'search', lucide: 'lucide-search' },
	{ icon: 'back', lucide: 'lucide-chevron-left' },
	{ icon: 'close', lucide: 'lucide-x' },
	{ icon: 'check', lucide: 'lucide-check' }
];

async function renderIconButton(props: Partial<IconButtonProps> = {}) {
	const IconButton = await loadUi<IconButtonProps>('IconButton');
	const target = stage();
	await render(IconButton, { target, props: { icon: 'search', label: LABEL, ...props } });
	const button = page.getByRole('button', { name: LABEL, exact: true });
	await expect.element(button).toBeInTheDocument();
	return button.element() as HTMLElement;
}

describe('IconButton semantics', () => {
	it('is a type="button" <button> named by the label prop', async () => {
		const button = await renderIconButton();
		expect(button.tagName).toBe('BUTTON');
		expect(button.getAttribute('type')).toBe('button');
		expect(button.getAttribute('aria-label')).toBe(LABEL);
	});

	it('has no visible text: the icon is its only content', async () => {
		const button = await renderIconButton();
		expect(button.textContent?.trim(), 'got visible text, want none').toBe('');
	});

	it('calls onclick when clicked', async () => {
		const onclick = vi.fn();
		const button = await renderIconButton({ onclick });
		button.click();
		expect(onclick, 'want one onclick call').toHaveBeenCalledTimes(1);
	});
});

describe('IconButton icons', () => {
	for (const { icon, lucide } of ICONS) {
		it(`renders the Lucide ${lucide} icon for "${icon}", hidden from assistive tech`, async () => {
			const svgs = (await renderIconButton({ icon })).querySelectorAll('svg');
			expect(svgs.length, `got ${svgs.length} <svg>, want 1`).toBe(1);
			const classes = svgs[0].getAttribute('class') ?? '';
			expect(classes, `got class "${classes}", want ${lucide}`).toContain(lucide);
			expect(svgs[0].getAttribute('aria-hidden')).toBe('true');
		});

		// Mobile README: "magnifier icon in ink (use your icon set; 15px)". The
		// README sizes only the magnifier; the rest of the set is assumed alike.
		it(`draws the "${icon}" icon ${ICON_PX}px in ink`, async () => {
			const svg = (await renderIconButton({ icon })).querySelector('svg')!;
			const { width, height } = svg.getBoundingClientRect();
			expect({ width, height }).toEqual({ width: ICON_PX, height: ICON_PX });
			expect(style(svg, 'color'), 'got a non-ink icon').toBe(computed('color', 'var(--ink)'));
		});
	}
});

describe('IconButton box', () => {
	// "Search button — 40×40 circle, 1.5px border `--border-chip`".
	it(`draws a ${VISUAL_PX}×${VISUAL_PX} circle with a 1.5px --border-chip border`, async () => {
		const visual = paintedBox(await renderIconButton());
		const { width, height } = visual.getBoundingClientRect();
		expect({ width, height }).toEqual({ width: VISUAL_PX, height: VISUAL_PX });
		expect(style(visual, 'border-top-width')).toBe(computed('border-top-width', '1.5px', SOLID));
		expect(style(visual, 'border-top-style')).toBe('solid');
		const borderChip = computed('border-top-color', 'var(--border-chip)');
		expect(style(visual, 'border-top-color')).toBe(borderChip);
		expect(parseFloat(style(visual, 'border-top-left-radius'))).toBeGreaterThanOrEqual(
			VISUAL_PX / 2
		);
	});

	// Accessibility: "All tap targets ≥ 44px ... extend the hit area".
	it(`answers pointer hits over at least ${HIT_MIN_PX}×${HIT_MIN_PX}`, async () => {
		const area = hitArea(await renderIconButton());
		expect(area.width, `got hit width ${area.width}`).toBeGreaterThanOrEqual(HIT_MIN_PX);
		expect(area.height, `got hit height ${area.height}`).toBeGreaterThanOrEqual(HIT_MIN_PX);
	});

	it('styles :hover only under @media (hover: hover)', async () => {
		const button = await renderIconButton();
		const rules = [button, paintedBox(button)].flatMap(ungatedHoverRules);
		expect(rules, `got ungated :hover rules ${JSON.stringify(rules)}`).toEqual([]);
	});
});
