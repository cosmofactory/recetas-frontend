import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page, userEvent } from 'vitest/browser';
import {
	computed,
	expectFullyVisible,
	hitArea,
	loadUi,
	paintedBox,
	stage,
	style,
	textLineCount,
	ungatedHoverRules,
	useViewport
} from '../../../testutil/ui';

// FE-3 BackPill: the desktop back control. Desktop README -> Variations page:
// "back pill ("‹ Popular" / "‹ Regional")"; Recipe page: "back pill (dish
// name when coming from the variations page, otherwise the region)". The
// label comes from the navigation origin (FE-6), so it is a prop here. The
// README gives no styles; the prototype (Asadorov Desktop.dc.html, both
// pills) does: `display:flex; align-items:center; gap:8px; padding:8px 16px
// 8px 12px; border-radius:999px; background:rgba(43,30,22,.06);
// font-size:13px; font-weight:600; align-self:flex-start`, hover
// `background:rgba(43,30,22,.11)`, the "‹" at `font-size:18px`, ink text.
// It renders the back chevron from the icon set (Assets) at 18px, then the
// label; it is a link (navigation), named by its visible label (WCAG 2.5.3).
// Hover only under (hover: hover); hit area ≥ 44px (Accessibility).

type BackPillProps = { label: string; href: string; onclick?: (event: MouseEvent) => void };

const LABEL = 'Popular';
const HREF = '/en/?tab=popular';
// The longest ru region or dish name in the content (a Recipe page pill).
const LONG_LABEL = 'Кастилия — Ла-Манча';
const ICON_PX = 18;
const GAP_PX = 8;
const HIT_MIN_PX = 44;
const PILL_BG = 'rgba(43, 30, 22, 0.06)';
const PILL_HOVER_BG = 'rgba(43, 30, 22, 0.11)';
// The prototype's page column: `display:flex; flex-direction:column`.
const PAGE_COLUMN = 'display: flex; flex-direction: column; width: 800px; padding: 40px';

async function renderPill(props: Partial<BackPillProps> = {}, target = stage(PAGE_COLUMN)) {
	const BackPill = await loadUi<BackPillProps>('BackPill');
	await render(BackPill, { target, props: { label: LABEL, href: HREF, ...props } });
	const link = page.getByRole('link', { name: props.label ?? LABEL, exact: true });
	await expect.element(link).toBeInTheDocument();
	return link.element() as HTMLElement;
}

function labelRect(pill: HTMLElement, label: string): DOMRect {
	const walker = document.createTreeWalker(pill, NodeFilter.SHOW_TEXT);
	for (let node = walker.nextNode(); node; node = walker.nextNode()) {
		if (node.textContent?.trim() !== label) continue;
		const range = document.createRange();
		range.selectNodeContents(node);
		return range.getBoundingClientRect();
	}
	throw new Error(`got no text node "${label}"`);
}

describe('BackPill semantics', () => {
	useViewport(1280, 800);

	it('is a link to href named by its visible label', async () => {
		const pill = await renderPill();
		expect(pill.tagName).toBe('A');
		expect(pill.getAttribute('href')).toBe(HREF);
		expect(pill.textContent?.trim()).toBe(LABEL);
	});

	it('shows the Lucide back chevron, 18px, before the label, hidden from assistive tech', async () => {
		const pill = await renderPill();
		const svgs = pill.querySelectorAll('svg');
		expect(svgs.length, `got ${svgs.length} <svg>, want 1`).toBe(1);
		expect(svgs[0].getAttribute('class') ?? '').toContain('lucide-chevron-left');
		expect(svgs[0].getAttribute('aria-hidden')).toBe('true');
		const icon = svgs[0].getBoundingClientRect();
		expect({ width: icon.width, height: icon.height }).toEqual({ width: ICON_PX, height: ICON_PX });
		expect(icon.right, 'want the chevron before the label').toBeLessThanOrEqual(
			labelRect(pill, LABEL).left
		);
	});

	it('calls onclick when clicked', async () => {
		const onclick = vi.fn((event: MouseEvent) => event.preventDefault());
		const pill = await renderPill({ onclick });
		pill.click();
		expect(onclick, 'want one onclick call').toHaveBeenCalledTimes(1);
	});
});

describe('BackPill look', () => {
	useViewport(1280, 800);

	it('is a pill in rgba(43,30,22,.06)', async () => {
		const visual = paintedBox(await renderPill());
		expect(style(visual, 'background-color')).toBe(PILL_BG);
		const { height } = visual.getBoundingClientRect();
		expect(parseFloat(style(visual, 'border-top-left-radius'))).toBeGreaterThanOrEqual(height / 2);
		expect(style(visual, 'border-top-width')).toBe('0px');
	});

	it('has padding 8px 16px 8px 12px', async () => {
		const visual = paintedBox(await renderPill());
		const padding = ['top', 'right', 'bottom', 'left'].map((side) =>
			style(visual, `padding-${side}`)
		);
		expect(padding).toEqual(['8px', '16px', '8px', '12px']);
	});

	it(`puts ${GAP_PX}px between the chevron and the label, centred on each other`, async () => {
		const pill = await renderPill();
		const icon = pill.querySelector('svg')!.getBoundingClientRect();
		const text = labelRect(pill, LABEL);
		expect(text.left - icon.right, 'got another gap').toBeCloseTo(GAP_PX, 0);
		const centre = (r: DOMRect) => r.top + r.height / 2;
		expect(Math.abs(centre(text) - centre(icon)), 'got them off-centre').toBeLessThanOrEqual(1);
	});

	it('sets the label in 13px/600 ink, the text font, not underlined', async () => {
		const pill = await renderPill();
		expect(style(pill, 'font-size')).toBe('13px');
		expect(style(pill, 'font-weight')).toBe('600');
		expect(style(pill, 'color')).toBe(computed('color', 'var(--ink)'));
		expect(style(pill, 'font-family')).toBe(computed('font-family', 'var(--font-text)'));
		expect(style(pill, 'text-decoration-line')).toBe('none');
	});

	it('is as wide as its content, not its column', async () => {
		const target = stage(PAGE_COLUMN);
		const pill = await renderPill({}, target);
		const { width } = paintedBox(pill).getBoundingClientRect();
		expect(width, `got a ${width}px pill stretched across the column`).toBeLessThan(
			target.clientWidth / 2
		);
	});

	it('turns rgba(43,30,22,.11) on hover, styled only under (hover: hover)', async () => {
		const pill = await renderPill();
		const visual = paintedBox(pill);
		const rules = [pill, visual].flatMap(ungatedHoverRules);
		expect(rules, `got ungated :hover rules ${JSON.stringify(rules)}`).toEqual([]);
		await userEvent.hover(pill);
		await expect.poll(() => style(visual, 'background-color')).toBe(PILL_HOVER_BG);
	});

	it(`answers pointer hits over at least ${HIT_MIN_PX}px each way`, async () => {
		const area = hitArea(await renderPill());
		expect(area.width, `got hit width ${area.width}`).toBeGreaterThanOrEqual(HIT_MIN_PX);
		expect(area.height, `got hit height ${area.height}`).toBeGreaterThanOrEqual(HIT_MIN_PX);
	});

	it('shows a long ru label in full on one line', async () => {
		const pill = await renderPill({ label: LONG_LABEL });
		expectFullyVisible(pill, LONG_LABEL);
		expect(textLineCount(pill), 'got the label wrapping').toBe(1);
	});
});
