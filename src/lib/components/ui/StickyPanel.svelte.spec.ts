import type { Snippet } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import { CONTENT_TEST_ID, content } from '../../../testutil/sheet';
import { computed, loadUi, stage, style, useViewport } from '../../../testutil/ui';

// FE-3 StickyPanel: the desktop container (F6) that shows the same content
// snippets as BottomSheet. Desktop README -> Layout & screens -> Regional:
// "Right: region panel, always visible (no sheet). Sticky (top 28px), height
// `calc(100vh − 140px)`, scrolls internally, surface card radius 22px, padding
// 32px 30px." The prototype (Asadorov Desktop.html) adds what the README
// leaves out, and the stage acceptance compares StickyPanel with it in a
// screenshot: `min-height:420px; box-sizing:border-box; border:1px solid
// rgba(43,30,22,.1)` (= --border-card) and `padding:32px 30px 22px`. Where
// they differ (the bottom padding) the prototype wins, as for buttons (owner
// decision 2026-10-20). 22px, the padding and 420px are not design tokens;
// they belong in layout.css. `label` names the panel (aria-label), a region
// landmark, so screen-reader users can jump to it.

type StickyPanelProps = { label: string; children: Snippet };

const LABEL = 'Andalucía';
const STICKY_TOP_PX = 28;
const OFFSET_PX = 140;
const MIN_HEIGHT_PX = 420;
const TALL = `<div data-testid="${CONTENT_TEST_ID}" style="height: 2000px"></div>`;

async function renderPanel(html?: string, target = stage()) {
	const StickyPanel = await loadUi<StickyPanelProps>('StickyPanel');
	await render(StickyPanel, { target, props: { label: LABEL, children: content(html) } });
	const region = page.getByRole('region', { name: LABEL, exact: true });
	await expect.element(region).toBeInTheDocument();
	return region.element() as HTMLElement;
}

const viewports = [
	{ width: 1280, height: 800 },
	{ width: 1440, height: 900 }
];

for (const { width, height } of viewports) {
	describe(`StickyPanel at ${width}×${height}`, () => {
		useViewport(width, height);

		it(`is calc(100vh - ${OFFSET_PX}px) = ${height - OFFSET_PX}px tall`, async () => {
			const panel = await renderPanel();
			expect(panel.getBoundingClientRect().height).toBe(height - OFFSET_PX);
		});

		it('keeps that height and scrolls internally when its content is taller', async () => {
			const panel = await renderPanel(TALL);
			expect(panel.getBoundingClientRect().height).toBe(height - OFFSET_PX);
			expect(style(panel, 'overflow-y')).toBe('auto');
			expect(panel.scrollHeight, 'want content taller than the panel').toBeGreaterThan(
				panel.clientHeight
			);
		});
	});
}

describe('StickyPanel in a short window', () => {
	useViewport(1280, 500);

	it(`keeps a min-height of ${MIN_HEIGHT_PX}px`, async () => {
		const panel = await renderPanel();
		expect(panel.getBoundingClientRect().height).toBe(MIN_HEIGHT_PX);
	});
});

describe('StickyPanel stickiness', () => {
	useViewport(1280, 800);
	afterEach(() => window.scrollTo(0, 0));

	it(`is position: sticky at top ${STICKY_TOP_PX}px`, async () => {
		const panel = await renderPanel();
		expect(style(panel, 'position')).toBe('sticky');
		expect(style(panel, 'top')).toBe(`${STICKY_TOP_PX}px`);
	});

	it(`stays ${STICKY_TOP_PX}px from the top while the page scrolls`, async () => {
		const column = stage('padding: 100px 0 0; height: 3000px');
		const panel = await renderPanel(undefined, column);
		window.scrollTo(0, column.getBoundingClientRect().top + window.scrollY + 600);
		expect(panel.getBoundingClientRect().top).toBe(STICKY_TOP_PX);
	});
});

describe('StickyPanel surface', () => {
	useViewport(1280, 800);

	it('is filled with --bg-surface', async () => {
		const panel = await renderPanel();
		const want = computed('background-color', 'var(--bg-surface)');
		expect(style(panel, 'background-color')).toBe(want);
	});

	it('rounds every corner by 22px', async () => {
		const panel = await renderPanel();
		const corners = ['top-left', 'top-right', 'bottom-right', 'bottom-left'];
		const radii = corners.map((c) => style(panel, `border-${c}-radius`));
		expect(radii).toEqual(['22px', '22px', '22px', '22px']);
	});

	it('has padding 32px 30px 22px (prototype)', async () => {
		const panel = await renderPanel();
		const padding = ['top', 'right', 'bottom', 'left'].map((s) => style(panel, `padding-${s}`));
		expect(padding).toEqual(['32px', '30px', '22px', '30px']);
	});

	it('has a 1px --border-card border (prototype)', async () => {
		const panel = await renderPanel();
		const sides = ['top', 'right', 'bottom', 'left'];
		expect(sides.map((side) => style(panel, `border-${side}-width`))).toEqual(
			sides.map(() => '1px')
		);
		const want = computed('border-top-color', 'var(--border-card)');
		expect(style(panel, 'border-top-color')).toBe(want);
	});

	it('renders its children', async () => {
		const panel = await renderPanel();
		const inside = panel.querySelectorAll(`[data-testid="${CONTENT_TEST_ID}"]`);
		expect(inside.length, 'want the content once, inside the panel').toBe(1);
	});
});
