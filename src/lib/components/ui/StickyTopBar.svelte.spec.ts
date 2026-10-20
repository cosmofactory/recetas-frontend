import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page, userEvent } from 'vitest/browser';
import { settle } from '../../../testutil/sheet';
import {
	animates,
	computed,
	emulateReducedMotion,
	hitArea,
	loadUi,
	paintedBox,
	resetEmulatedMedia,
	stage,
	style,
	transitionDuration,
	ungatedHoverRules,
	useViewport
} from '../../../testutil/ui';

// FE-3 StickyTopBar: the Variations and Recipe pages' bar. Mobile README ->
// Screen 2: "Sticky top bar (padding 14px 16px, bg rgba(246,239,227,.94) +
// backdrop-filter: blur(8px)): back button 38×38 circle, bg
// rgba(43,30,22,.07), "‹" 20px. Dish name (13px/600) fades in (opacity 0 → 1,
// 200ms) and a hairline bottom border appears once scrolled past 230px."
// Screen 3: "Same sticky bar (title = variation name, appears after 280px)".
// The prototypes (DishVariations.dc.html / Recipe.dc.html, the bar <div>)
// add: `position:sticky; top:0; z-index:3; display:flex;
// align-items:center; gap:10px`, the back hover `rgba(43,30,22,.13)`, the
// border `1px solid` always present and coloured `rgba(43,30,22,.1)`
// (= --border-card) past the threshold, else transparent, and (Recipe) a
// one-line title, `white-space:nowrap; text-overflow:ellipsis`. Where README
// and prototype differ the prototype wins (FE-3 owner decision): the
// "hairline" is --border-card, not --border-hairline.
//
// Props: backHref (the back control is a link), backLabel (its accessible
// name; the chevron is its only content), title, threshold (px, required:
// screens pass 230 / 280), scrollContainer (default: the window), onBack
// (optional click handler, e.g. for history.back()). The bar's root element
// is the element the component renders into its target.
//
// Below the threshold the faded title is aria-hidden: the page's <h1> already
// names the page, so the invisible duplicate would only be read twice. Past
// it, the title is exposed. Reduced motion: the opacity fade stays (it is
// not a slide), and nothing moves.

type StickyTopBarProps = {
	backHref: string;
	backLabel: string;
	title: string;
	threshold: number;
	scrollContainer?: HTMLElement;
	onBack?: (event: MouseEvent) => void;
};

const BACK_HREF = '/en/';
const BACK_LABEL = 'Back';
const TITLE = 'Tortilla de patatas';
const LONG_TITLE = 'Тортилья по-бетансосски, жидкая внутри, без лука, с хлебом';
const THRESHOLD = 230;
const BACK_PX = 38;
const ICON_PX = 20;
const HIT_MIN_PX = 44;
const GAP_PX = 10;
const TALL_PX = 4000;
const TRANSPARENT = 'rgba(0, 0, 0, 0)';
// Prototype values; the component reads them from layout.css tokens.
const BAR_BG = 'rgba(246, 239, 227, 0.94)';
const BAR_BLUR = 'blur(8px)';
const BACK_BG = 'rgba(43, 30, 22, 0.07)';
const BACK_HOVER_BG = 'rgba(43, 30, 22, 0.13)';
const SOLID = 'border-style: solid';

const DEFAULTS: StickyTopBarProps = {
	backHref: BACK_HREF,
	backLabel: BACK_LABEL,
	title: TITLE,
	threshold: THRESHOLD
};

afterEach(async () => {
	window.scrollTo(0, 0);
	await resetEmulatedMedia();
});

function spacer(parent: HTMLElement, height = TALL_PX) {
	const el = document.createElement('div');
	el.style.height = `${height}px`;
	parent.append(el);
}

// The deepest element whose text is the title.
function titleIn(bar: HTMLElement, title: string): HTMLElement {
	const matches = [...bar.querySelectorAll<HTMLElement>('*')].filter(
		(el) => el.textContent?.trim() === title
	);
	expect(matches.length, `got no element with the title "${title}"`).toBeGreaterThan(0);
	return matches.at(-1)!;
}

// A page to scroll: the bar at the top of a tall stage (or of `target`).
async function renderBar(props: Partial<StickyTopBarProps> = {}, target = stage('padding: 0')) {
	const StickyTopBar = await loadUi<StickyTopBarProps>('StickyTopBar');
	const result = await render(StickyTopBar, { target, props: { ...DEFAULTS, ...props } });
	spacer(target);
	const link = page.getByRole('link', { name: props.backLabel ?? BACK_LABEL, exact: true });
	await expect.element(link).toBeInTheDocument();
	const bar = [...target.children].find((el) => el.contains(link.element())) as HTMLElement;
	const title = titleIn(bar, props.title ?? TITLE);
	return { bar, back: link.element() as HTMLElement, title, result };
}

function isHidden(title: HTMLElement): boolean {
	return title.closest('[aria-hidden="true"]') !== null;
}

function nextFrame(): Promise<void> {
	return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

// Scrolls `scroller` (the window by default) to y and waits for the scroll
// event and two frames, so a listener (rAF-throttled or not) has run.
async function scrollTo(y: number, scroller: HTMLElement | Window = window) {
	const scrolled = new Promise((resolve) =>
		scroller.addEventListener('scroll', resolve, { once: true })
	);
	scroller.scrollTo(0, y);
	await scrolled;
	await nextFrame();
	await nextFrame();
}

async function expectShown(title: HTMLElement) {
	await expect.poll(() => isHidden(title), { timeout: 1000 }).toBe(false);
	settle();
	expect(style(title, 'opacity'), 'want the title faded in').toBe('1');
}

function expectFaded(title: HTMLElement) {
	settle();
	expect(isHidden(title), 'want the faded title aria-hidden').toBe(true);
	expect(style(title, 'opacity'), 'want the title faded out').toBe('0');
}

describe('StickyTopBar back control', () => {
	useViewport(390, 844);

	it('is a link to backHref named by backLabel', async () => {
		const { back } = await renderBar();
		expect(back.tagName).toBe('A');
		expect(back.getAttribute('href')).toBe(BACK_HREF);
	});

	it('shows the Lucide back chevron, 20px, in ink and hidden from assistive tech', async () => {
		const { back } = await renderBar();
		const svgs = back.querySelectorAll('svg');
		expect(svgs.length, `got ${svgs.length} <svg>, want 1`).toBe(1);
		expect(svgs[0].getAttribute('class') ?? '').toContain('lucide-chevron-left');
		expect(svgs[0].getAttribute('aria-hidden')).toBe('true');
		const { width, height } = svgs[0].getBoundingClientRect();
		expect({ width, height }).toEqual({ width: ICON_PX, height: ICON_PX });
		expect(style(svgs[0], 'color')).toBe(computed('color', 'var(--ink)'));
	});

	it(`draws a ${BACK_PX}×${BACK_PX} circle in rgba(43,30,22,.07)`, async () => {
		const visual = paintedBox((await renderBar()).back);
		const { width, height } = visual.getBoundingClientRect();
		expect({ width, height }).toEqual({ width: BACK_PX, height: BACK_PX });
		expect(style(visual, 'background-color')).toBe(BACK_BG);
		expect(parseFloat(style(visual, 'border-top-left-radius'))).toBeGreaterThanOrEqual(BACK_PX / 2);
	});

	it(`answers pointer hits over at least ${HIT_MIN_PX}×${HIT_MIN_PX}`, async () => {
		const area = hitArea((await renderBar()).back);
		expect(area.width, `got hit width ${area.width}`).toBeGreaterThanOrEqual(HIT_MIN_PX);
		expect(area.height, `got hit height ${area.height}`).toBeGreaterThanOrEqual(HIT_MIN_PX);
	});

	it('turns rgba(43,30,22,.13) on hover, styled only under (hover: hover)', async () => {
		const { back } = await renderBar();
		const visual = paintedBox(back);
		const rules = [back, visual].flatMap(ungatedHoverRules);
		expect(rules, `got ungated :hover rules ${JSON.stringify(rules)}`).toEqual([]);
		await userEvent.hover(back);
		await expect.poll(() => style(visual, 'background-color')).toBe(BACK_HOVER_BG);
	});

	it('calls onBack with the click event', async () => {
		const onBack = vi.fn((event: MouseEvent) => event.preventDefault());
		const { back } = await renderBar({ onBack });
		back.click();
		expect(onBack, 'want one onBack call').toHaveBeenCalledTimes(1);
		expect(onBack.mock.calls[0][0]).toBeInstanceOf(MouseEvent);
	});
});

describe('StickyTopBar box', () => {
	useViewport(390, 844);

	it('sticks to the top of the viewport at z-index above the page', async () => {
		const { bar } = await renderBar();
		expect(style(bar, 'position')).toBe('sticky');
		expect(style(bar, 'top')).toBe('0px');
		expect(Number(style(bar, 'z-index')), 'want a positive z-index').toBeGreaterThan(0);
		await scrollTo(600);
		expect(bar.getBoundingClientRect().top, 'got the bar scrolled away').toBeCloseTo(0, 0);
	});

	it('has padding 14px 16px', async () => {
		const { bar } = await renderBar();
		const padding = ['top', 'right', 'bottom', 'left'].map((side) => style(bar, `padding-${side}`));
		expect(padding).toEqual(['14px', '16px', '14px', '16px']);
	});

	it('is rgba(246,239,227,.94) behind blur(8px)', async () => {
		const { bar } = await renderBar();
		expect(style(bar, 'background-color')).toBe(BAR_BG);
		expect(style(bar, 'backdrop-filter')).toBe(BAR_BLUR);
	});

	it(`puts the title ${GAP_PX}px after the back button, centred on it`, async () => {
		const { back, title } = await renderBar();
		const circle = paintedBox(back).getBoundingClientRect();
		const text = title.getBoundingClientRect();
		expect(text.left - circle.right, 'got another gap').toBeCloseTo(GAP_PX, 0);
		const centre = (r: DOMRect) => r.top + r.height / 2;
		expect(Math.abs(centre(text) - centre(circle)), 'got the title off-centre').toBeLessThanOrEqual(
			1
		);
	});

	it('sets the title in 13px/600 ink', async () => {
		const { title } = await renderBar();
		expect(style(title, 'font-size')).toBe('13px');
		expect(style(title, 'font-weight')).toBe('600');
		expect(style(title, 'color')).toBe(computed('color', 'var(--ink)'));
	});
});

describe('StickyTopBar with a long title at 360px', () => {
	useViewport(360, 740);

	it('keeps the title on one line with an ellipsis, inside the bar', async () => {
		const short = (await renderBar()).title.getBoundingClientRect().height;
		const { bar, title } = await renderBar({ title: LONG_TITLE, backLabel: 'Назад' });
		const height = title.getBoundingClientRect().height;
		expect(height, `got a ${height}px title, want one line (${short}px)`).toBe(short);
		expect(style(title, 'text-overflow')).toBe('ellipsis');
		expect(bar.scrollWidth, 'got the bar overflowing').toBeLessThanOrEqual(bar.clientWidth);
	});
});

describe('StickyTopBar past the threshold (window scroll)', () => {
	useViewport(390, 844);

	for (const threshold of [230, 280]) {
		describe(`threshold ${threshold}`, () => {
			it('fades the title out and hides it from assistive tech at the top', async () => {
				const { title } = await renderBar({ threshold });
				expectFaded(title);
			});

			it(`keeps it faded at exactly ${threshold}px`, async () => {
				const { title } = await renderBar({ threshold });
				await scrollTo(threshold);
				expectFaded(title);
			});

			it(`fades the title in and exposes it past ${threshold}px`, async () => {
				const { title } = await renderBar({ threshold });
				await scrollTo(threshold + 1);
				await expectShown(title);
			});

			it('fades it out again when scrolled back up', async () => {
				const { title } = await renderBar({ threshold });
				await scrollTo(threshold + 100);
				await expectShown(title);
				await scrollTo(threshold - 100);
				await expect.poll(() => isHidden(title), { timeout: 1000 }).toBe(true);
				expectFaded(title);
			});
		});
	}

	it('fades the title over 200ms', async () => {
		const { title } = await renderBar();
		expect(transitionDuration(title, 'opacity')).toBe('0.2s');
	});

	it('shows the title at once when the page is already scrolled past', async () => {
		const target = stage('padding: 0');
		spacer(target);
		await scrollTo(THRESHOLD + 200);
		const { title } = await renderBar({}, target);
		await expectShown(title);
	});

	it('draws the 1px bottom border transparent at the top, --border-card past it', async () => {
		const { bar } = await renderBar();
		expect(style(bar, 'border-bottom-width')).toBe(computed('border-bottom-width', '1px', SOLID));
		expect(style(bar, 'border-bottom-style')).toBe('solid');
		expect(style(bar, 'border-bottom-color')).toBe(TRANSPARENT);
		await scrollTo(THRESHOLD + 1);
		const card = computed('border-bottom-color', 'var(--border-card)');
		await expect.poll(() => style(bar, 'border-bottom-color'), { timeout: 1000 }).toBe(card);
	});

	it('keeps its height when the border and title appear', async () => {
		const { bar, title } = await renderBar();
		const before = bar.getBoundingClientRect().height;
		await scrollTo(THRESHOLD + 1);
		await expectShown(title);
		expect(bar.getBoundingClientRect().height, 'got a layout shift').toBe(before);
	});
});

describe('StickyTopBar with a scroll container', () => {
	useViewport(390, 844);

	function scroller(): HTMLElement {
		return stage('padding: 0; height: 400px; overflow-y: auto');
	}

	it('follows the container’s scroll position', async () => {
		const container = scroller();
		const { title } = await renderBar({ scrollContainer: container }, container);
		expectFaded(title);
		await scrollTo(THRESHOLD + 1, container);
		await expectShown(title);
	});

	it('ignores the window scroll when given a container', async () => {
		const container = scroller();
		const { title } = await renderBar({ scrollContainer: container }, container);
		spacer(stage('padding: 0'));
		await scrollTo(THRESHOLD + 500);
		expectFaded(title);
	});

	it('follows a container given after mount', async () => {
		const container = scroller();
		const { title, result } = await renderBar({}, container);
		await result.rerender({ scrollContainer: container });
		await scrollTo(THRESHOLD + 1, container);
		await expectShown(title);
	});
});

describe('StickyTopBar under reduced motion', () => {
	useViewport(390, 844);

	it('still fades the title, and nothing in the bar animates a transform', async () => {
		await emulateReducedMotion('reduce');
		const { bar, title } = await renderBar();
		expect(animates(title, 'opacity'), 'want the title opacity fade kept').toBe(true);
		const moving = [bar, ...bar.querySelectorAll('*')].filter((el) => animates(el, 'transform'));
		expect(
			moving.map((el) => el.tagName),
			'got transform transitions'
		).toEqual([]);
	});
});
