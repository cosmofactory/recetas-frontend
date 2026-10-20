import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page, userEvent } from 'vitest/browser';
import {
	computed,
	expectFullyVisible,
	hitArea,
	hits,
	loadHarness,
	loadUi,
	paintedBox,
	stage,
	style,
	textLineCount,
	transitionDuration,
	ungatedHoverRules
} from '../../../testutil/ui';

// FE-3 Chip: the on/off filter chip. Mobile README -> Popular tab -> Filter
// bar: "Chip: pill, padding 8px 13px, 12px/600, 1px border. Off: transparent,
// border `--border-chip`, ink text. On: bg + border ink, text `--on-accent`.
// 200ms." It is a toggle button (aria-pressed) and is controlled: a click asks
// the caller to flip it through onToggle(next); `pressed` comes back as a prop
// (the filters live in the URL, F6).
//
// Accessibility: "All tap targets ≥ 44px tall ... (chips may be 34px tall
// visually; extend the hit area)". Localization -> Length: "chips must not
// truncate; chip rows scroll horizontally". ChipRow is that row: the filter
// bar scrolls ("horizontally scrolling row, gap 7px, scrollbar hidden"), the
// Filters sheet wraps ("wrapping chip row (gap 7px)") = `--chip-gap`.

type ChipProps = { label: string; pressed: boolean; onToggle: (pressed: boolean) => void };
type HarnessProps = { labels: string[]; wrap?: boolean };

const LABEL = 'Vegetarian';
const HIT_MIN_PX = 44;
const TRANSPARENT = 'rgba(0, 0, 0, 0)';
// home.filterLabels in ru (strings.json), the longest copy.
const RU_LABELS = [
	'Вегетарианское',
	'Морепродукты',
	'Со свининой',
	'Тапас',
	'Основные',
	'Десерты',
	'Быстро',
	'Долгая готовка',
	'Лето',
	'Зима',
	'Страстная неделя',
	'Круглый год'
];
// Acceptance: "Chip labels don't truncate in ru at 360px" (the narrowest
// phone width the README supports, "must flex 360–430px wide").
// Padding all round, so hit areas past the row's edges stay on screen.
const NARROW_ROW = 'width: 360px; padding: 40px';
// Hit testing lands on whole device pixels, so probes keep this far from a
// sub-pixel boundary such as the middle of the 7px row gap.
const PIXEL_SNAP_PX = 1.5;

async function renderChip(props: Partial<ChipProps> = {}) {
	const Chip = await loadUi<ChipProps>('Chip');
	const all: ChipProps = { label: LABEL, pressed: false, onToggle: () => {}, ...props };
	const result = await render(Chip, { target: stage(), props: all });
	const chip = page.getByRole('button', { name: all.label, exact: true });
	await expect.element(chip).toBeInTheDocument();
	return { chip: chip.element() as HTMLElement, rerender: result.rerender };
}

type Box = { left: number; right: number; top: number; bottom: number };

// The box a chip's hit area should fill: the visual box grown to --hit-min
// on each axis, centred on it.
function expectedHitBox(chip: HTMLElement): Box {
	const r = chip.getBoundingClientRect();
	const halfWidth = Math.max(r.width, HIT_MIN_PX) / 2;
	const halfHeight = Math.max(r.height, HIT_MIN_PX) / 2;
	const x = r.left + r.width / 2;
	const y = r.top + r.height / 2;
	return { left: x - halfWidth, right: x + halfWidth, top: y - halfHeight, bottom: y + halfHeight };
}

// Half a pixel inside each corner: the 1px border strips of the visual box
// extended out to the hit box's edges (QA S4).
const CORNER_INSET_PX = 0.5;
function cornerPoints(box: Box): { name: string; x: number; y: number }[] {
	const [l, r] = [box.left + CORNER_INSET_PX, box.right - CORNER_INSET_PX];
	const [t, b] = [box.top + CORNER_INSET_PX, box.bottom - CORNER_INSET_PX];
	return [
		{ name: 'top-left', x: l, y: t },
		{ name: 'top-right', x: r, y: t },
		{ name: 'bottom-left', x: l, y: b },
		{ name: 'bottom-right', x: r, y: b }
	];
}

function expectCornersHit(chip: HTMLElement) {
	for (const { name, x, y } of cornerPoints(expectedHitBox(chip))) {
		expect(hits(chip, x, y), `got a miss at the ${name} corner (${x}, ${y})`).toBe(true);
	}
}

function overlap(a: DOMRect, b: DOMRect): number {
	return Math.min(a.right, b.right) - Math.max(a.left, b.left);
}

// A chip on the first line and one on the next line that sit above each
// other, with an x inside both.
function stackedPair(chips: HTMLElement[]) {
	const rects = chips.map((chip) => chip.getBoundingClientRect());
	const firstBottom = rects[0].bottom;
	const nextTop = Math.min(...rects.filter((r) => r.top > firstBottom).map((r) => r.top));
	const pairs = chips.flatMap((upper, i) => chips.map((lower, j) => ({ upper, lower, i, j })));
	const pair = pairs.find(
		({ i, j }) =>
			rects[i].bottom === firstBottom && rects[j].top === nextTop && overlap(rects[i], rects[j]) > 2
	);
	expect(pair, 'got no two chips stacked on adjacent lines').toBeDefined();
	const [a, b] = [rects[pair!.i], rects[pair!.j]];
	return { ...pair!, a, b, x: Math.max(a.left, b.left) + overlap(a, b) / 2 };
}

async function renderRow(props: HarnessProps) {
	const Harness = await loadHarness<HarnessProps>('ChipRowHarness');
	const target = stage(NARROW_ROW);
	await render(Harness, { target, props });
	const chips = props.labels.map((name) => page.getByRole('button', { name, exact: true }));
	await expect.element(chips[0]).toBeInTheDocument();
	const row = target.firstElementChild as HTMLElement;
	return { row, chips: chips.map((c) => c.element() as HTMLElement) };
}

describe('Chip state', () => {
	for (const pressed of [false, true]) {
		it(`is a type="button" toggle with aria-pressed="${pressed}"`, async () => {
			const { chip } = await renderChip({ pressed });
			expect(chip.tagName).toBe('BUTTON');
			expect(chip.getAttribute('type')).toBe('button');
			expect(chip.getAttribute('aria-pressed')).toBe(String(pressed));
		});

		it(`asks to become ${!pressed} when clicked while ${pressed}`, async () => {
			const onToggle = vi.fn();
			const { chip } = await renderChip({ pressed, onToggle });
			await page.elementLocator(chip).click();
			expect(onToggle.mock.calls, 'want one onToggle call').toEqual([[!pressed]]);
		});
	}

	it('follows the pressed prop when the caller flips it', async () => {
		const { chip, rerender } = await renderChip({ pressed: false });
		await rerender({ pressed: true });
		expect(chip.getAttribute('aria-pressed')).toBe('true');
		await rerender({ pressed: false });
		expect(chip.getAttribute('aria-pressed')).toBe('false');
	});
});

describe('Chip look', () => {
	const looks = [
		{ pressed: false, background: 'transparent', border: 'var(--border-chip)', text: 'var(--ink)' },
		{ pressed: true, background: 'var(--ink)', border: 'var(--ink)', text: 'var(--on-accent)' }
	];
	for (const look of looks) {
		it(`paints ${look.pressed ? 'on' : 'off'}: bg ${look.background}, border ${look.border}, text ${look.text}`, async () => {
			const visual = paintedBox((await renderChip({ pressed: look.pressed })).chip);
			const want =
				look.background === 'transparent'
					? TRANSPARENT
					: computed('background-color', look.background);
			expect(style(visual, 'background-color'), 'background').toBe(want);
			expect(style(visual, 'border-top-color'), 'border').toBe(
				computed('border-top-color', look.border)
			);
			expect(style(visual, 'color'), 'text').toBe(computed('color', look.text));
		});
	}

	// "pill, padding 8px 13px, 12px/600, 1px border".
	it('is a pill with padding 8px 13px, a 1px border and 12px/600 text', async () => {
		const visual = paintedBox((await renderChip()).chip);
		const got = {
			padding: style(visual, 'padding'),
			border: style(visual, 'border-top-width'),
			radius: style(visual, 'border-top-left-radius'),
			fontSize: style(visual, 'font-size'),
			fontWeight: style(visual, 'font-weight'),
			fontFamily: style(visual, 'font-family')
		};
		expect(got).toEqual({
			padding: '8px 13px',
			border: computed('border-top-width', '1px', 'border-style: solid'),
			radius: computed('border-top-left-radius', 'var(--radius-pill)'),
			fontSize: '12px',
			fontWeight: '600',
			fontFamily: computed('font-family', 'var(--font-text)')
		});
	});

	// "200ms" = --dur-colour.
	for (const property of ['background-color', 'border-color', 'color']) {
		it(`transitions ${property} over --dur-colour (200ms)`, async () => {
			const visual = paintedBox((await renderChip()).chip);
			expect(transitionDuration(visual, property)).toBe(
				computed('transition-duration', 'var(--dur-colour)')
			);
		});
	}

	it('styles :hover only under @media (hover: hover)', async () => {
		const { chip } = await renderChip();
		const rules = [chip, paintedBox(chip)].flatMap(ungatedHoverRules);
		expect(rules, `got ungated :hover rules ${JSON.stringify(rules)}`).toEqual([]);
	});
});

describe('Chip hit area', () => {
	it(`answers pointer hits at least ${HIT_MIN_PX}px tall`, async () => {
		const { height } = hitArea((await renderChip()).chip);
		expect(height, `got hit height ${height}`).toBeGreaterThanOrEqual(HIT_MIN_PX);
	});

	// "chips may be 34px tall visually": the hit area grows, the visual doesn't.
	it(`keeps the visual box shorter than ${HIT_MIN_PX}px, sized by its padding and text`, async () => {
		const visual = paintedBox((await renderChip()).chip);
		const { height } = visual.getBoundingClientRect();
		expect(height, `got visual height ${height}`).toBeLessThan(HIT_MIN_PX);
	});
});

describe('Chip hit-area corners', () => {
	it('answers hits in all four corners of the hit box, border strips included', async () => {
		expectCornersHit((await renderChip()).chip);
	});

	it('answers hits in all four corners inside a scrolling ChipRow', async () => {
		const { chips } = await renderRow({ labels: RU_LABELS.slice(0, 2) });
		chips.forEach(expectCornersHit);
	});
});

describe('Chip label', () => {
	it('renders the label on one line, in full', async () => {
		const { chip } = await renderChip({ label: 'Страстная неделя' });
		expectFullyVisible(chip, 'Страстная неделя');
		expect(textLineCount(chip), 'got the label on several lines').toBe(1);
	});
});

describe('ChipRow, scrolling (the filter bar)', () => {
	it('scrolls horizontally with the scrollbar hidden and a --chip-gap (7px) gap', async () => {
		const { row } = await renderRow({ labels: RU_LABELS });
		const got = {
			overflowX: style(row, 'overflow-x'),
			flexWrap: style(row, 'flex-wrap'),
			gap: style(row, 'column-gap'),
			scrollbar: style(row, 'scrollbar-width')
		};
		const gap = computed('column-gap', 'var(--chip-gap)');
		expect(got).toEqual({ overflowX: 'auto', flexWrap: 'nowrap', gap, scrollbar: 'none' });
		expect(row.scrollWidth, 'got a row that does not overflow at 360px').toBeGreaterThan(
			row.clientWidth
		);
	});

	it('shows every ru label in full, on one line, at 360px wide', async () => {
		const { chips } = await renderRow({ labels: RU_LABELS });
		chips.forEach((chip, i) => {
			expectFullyVisible(chip, RU_LABELS[i]);
			expect(textLineCount(chip), `got "${RU_LABELS[i]}" on several lines`).toBe(1);
		});
	});

	it('lets the last chip scroll fully into view', async () => {
		const { row, chips } = await renderRow({ labels: RU_LABELS });
		row.scrollLeft = row.scrollWidth;
		const last = chips.at(-1)!.getBoundingClientRect();
		expect(last.right, 'got the last chip cut off').toBeLessThanOrEqual(
			row.getBoundingClientRect().right + 1
		);
	});

	// The row clips vertically too (overflow-x: auto forces overflow-y), so
	// the hit area must still fit inside it.
	it(`keeps every chip's hit area at least ${HIT_MIN_PX}px tall inside the row`, async () => {
		const { chips } = await renderRow({ labels: RU_LABELS.slice(0, 2) });
		for (const chip of chips) {
			const { height } = hitArea(chip);
			expect(height, `got hit height ${height} for "${chip.textContent}"`).toBeGreaterThanOrEqual(
				HIT_MIN_PX
			);
		}
	});
});

describe('ChipRow, wrapping (the Filters sheet)', () => {
	it('wraps onto new lines with a --chip-gap (7px) gap and never scrolls sideways', async () => {
		const { row, chips } = await renderRow({ labels: RU_LABELS, wrap: true });
		expect(style(row, 'flex-wrap')).toBe('wrap');
		expect(style(row, 'column-gap')).toBe(computed('column-gap', 'var(--chip-gap)'));
		expect(style(row, 'row-gap')).toBe(computed('row-gap', 'var(--chip-gap)'));
		expect(row.scrollWidth, 'got a wrapping row wider than 360px').toBeLessThanOrEqual(
			row.clientWidth
		);
		chips.forEach((chip, i) => expectFullyVisible(chip, RU_LABELS[i]));
	});

	// Stage FE-3 -> Acceptance, hit-area exception: in a wrapping row "each
	// chip's hit area extends only half the gap above and below (no overlap;
	// about 39px tall) ... Horizontal extension and the scrolling row keep the
	// full 44px."
	it('splits the row gap between vertically adjacent chips: no overlap', async () => {
		const { chips } = await renderRow({ labels: RU_LABELS, wrap: true });
		const { upper, lower, a, b, x } = stackedPair(chips);
		const middle = a.bottom + (b.top - a.bottom) / 2;
		const probes = [
			{ name: 'just below the upper chip', y: a.bottom + 1, want: upper },
			{ name: 'above the gap midpoint', y: middle - PIXEL_SNAP_PX, want: upper },
			{ name: 'below the gap midpoint', y: middle + PIXEL_SNAP_PX, want: lower },
			{ name: 'just above the lower chip', y: b.top - 1, want: lower }
		];
		for (const { name, y, want } of probes) {
			const other = want === upper ? lower : upper;
			expect(hits(want, x, y), `${name}: got a miss on "${want.textContent?.trim()}"`).toBe(true);
			expect(hits(other, x, y), `${name}: got a hit on "${other.textContent?.trim()}"`).toBe(false);
		}
	});

	it('grows each chip vertically by half the row gap above and below', async () => {
		const { row, chips } = await renderRow({ labels: RU_LABELS, wrap: true });
		const gap = parseFloat(style(row, 'row-gap'));
		const { upper, a } = stackedPair(chips);
		const { height } = hitArea(upper);
		const want = a.height + gap;
		expect(
			Math.abs(height - want),
			`got hit height ${height}, want ${want} (±1px)`
		).toBeLessThanOrEqual(1);
	});

	it(`keeps a ${HIT_MIN_PX}px-wide hit area for a chip narrower than that`, async () => {
		const { chips } = await renderRow({ labels: ['Я'], wrap: true });
		const visual = chips[0].getBoundingClientRect().width;
		expect(visual, 'want the fixture chip narrower than the hit minimum').toBeLessThan(HIT_MIN_PX);
		const { width } = hitArea(chips[0]);
		expect(width, `got hit width ${width}`).toBeGreaterThanOrEqual(HIT_MIN_PX);
	});
});

// FE-3 re-review: a scroller clips its content, so the keyboard focus ring of
// the first and last chip must fit inside the row's visible scrollport
// (border box grown by --focus-ring-width + --focus-ring-offset on each
// side). Room made for it with inline padding must not shift the row: the
// first chip still starts at the container's content edge (negative margin).
describe('ChipRow, scrolling: focus ring', () => {
	type Rect = { left: number; right: number; top: number; bottom: number };

	function ringExtent(): number {
		const root = getComputedStyle(document.documentElement);
		const width = parseFloat(root.getPropertyValue('--focus-ring-width'));
		const offset = parseFloat(root.getPropertyValue('--focus-ring-offset'));
		expect(width + offset, 'got no --focus-ring-width/--focus-ring-offset tokens').toBeGreaterThan(
			0
		);
		return width + offset;
	}

	function scroller(chip: HTMLElement): HTMLElement {
		let el = chip.parentElement;
		while (el && getComputedStyle(el).overflowX !== 'auto') el = el.parentElement;
		expect(el, 'got no scrolling ancestor').not.toBeNull();
		return el!;
	}

	function scrollport(row: HTMLElement): Rect {
		const r = row.getBoundingClientRect();
		const left = r.left + row.clientLeft;
		const top = r.top + row.clientTop;
		return { left, top, right: left + row.clientWidth, bottom: top + row.clientHeight };
	}

	function expectRingInside(chip: HTMLElement, port: Rect) {
		const extent = ringExtent();
		const c = chip.getBoundingClientRect();
		const ring = {
			left: c.left - extent,
			right: c.right + extent,
			top: c.top - extent,
			bottom: c.bottom + extent
		};
		const name = chip.textContent?.trim();
		expect(ring.left, `"${name}" ring clipped on the left`).toBeGreaterThanOrEqual(port.left - 0.5);
		expect(ring.right, `"${name}" ring clipped on the right`).toBeLessThanOrEqual(port.right + 0.5);
		expect(ring.top, `"${name}" ring clipped at the top`).toBeGreaterThanOrEqual(port.top - 0.5);
		expect(ring.bottom, `"${name}" ring clipped at the bottom`).toBeLessThanOrEqual(
			port.bottom + 0.5
		);
	}

	// The row between two plain buttons, so Tab / Shift+Tab land on its ends.
	async function renderFocusRow() {
		const target = stage(NARROW_ROW);
		const Harness = await loadHarness<HarnessProps>('ChipRowHarness');
		await render(Harness, { target, props: { labels: RU_LABELS } });
		const [before, after] = [document.createElement('button'), document.createElement('button')];
		target.prepend(before);
		target.append(after);
		const chips = RU_LABELS.map(
			(name) =>
				page
					.elementLocator(target)
					.getByRole('button', { name, exact: true })
					.element() as HTMLElement
		);
		return { target, before, after, chips, row: scroller(chips[0]) };
	}

	it("keeps the first chip's focus ring inside the scrollport", async () => {
		const { before, chips, row } = await renderFocusRow();
		before.focus();
		await userEvent.tab();
		expect(document.activeElement, 'got Tab landing elsewhere').toBe(chips[0]);
		row.scrollLeft = 0;
		expectRingInside(chips[0], scrollport(row));
	});

	it("keeps the last chip's focus ring inside the scrollport, scrolled to the end", async () => {
		const { after, chips, row } = await renderFocusRow();
		after.focus();
		await userEvent.tab({ shift: true });
		const last = chips.at(-1)!;
		expect(document.activeElement, 'got Shift+Tab landing elsewhere').toBe(last);
		row.scrollLeft = row.scrollWidth;
		expectRingInside(last, scrollport(row));
	});

	it("starts the first chip at the container's content edge", async () => {
		const { target, chips, row } = await renderFocusRow();
		row.scrollLeft = 0;
		const contentLeft =
			target.getBoundingClientRect().left + parseFloat(style(target, 'padding-left'));
		const chipLeft = chips[0].getBoundingClientRect().left;
		expect(chipLeft, `got the first chip at ${chipLeft}, want ${contentLeft}`).toBeCloseTo(
			contentLeft,
			0
		);
	});
});
