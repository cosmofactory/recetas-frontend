import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { userEvent } from 'vitest/browser';
import { getLocale, overwriteGetLocale } from '#lib/paraglide/runtime.js';
import type { FilterBarProps } from '../../../testutil/popular';
import {
	FILTERS_ACTIVE_ATTR,
	filtersLabel,
	POPULAR_COPY,
	QUICK_IDS,
	TEST_IDS,
	type PopularLocale
} from '../../../testutil/popular-copy';
import {
	computed,
	expectFullyVisible,
	loadHome,
	stage,
	style,
	textLineCount
} from '../../../testutil/ui';

// FE-5 PR 1, FilterBar: the mobile Popular filter bar (in the header, under
// the switch).
//
// Sources:
// - Mobile README -> Popular tab — body L83–85: "horizontally scrolling row,
//   gap 7px, scrollbar hidden. First item: Filters button — pill, padding
//   8px 13px, 12px/700. Label "Filters", or "Filters · N" when N filters are
//   active; when N>0 it fills ink with --on-accent text. Opens the Filters
//   sheet. Then 4 quick chips: Vegetarian, Quick, Desserts, Summer. Chip:
//   pill, padding 8px 13px, 12px/600, 1px border. Off: transparent, border
//   --border-chip, ink text. On: bg + border ink, text --on-accent."
// - Prototype L251–256: countLabel = filters + ' · ' + active.length (N
//   counts every active filter, not only the quick ones); gear border ink
//   when N>0, else rgba(43,30,22,.22) (= --border-chip); every item
//   white-space nowrap, flex none.
// - Filters sheet L110: "The quick chips on the bar are the same filters
//   (they stay in sync)"; stage FE-5: "the URL is the single source of truth".
// - Stage FE-5 -> Filter bar: "no scrollbar and no truncation in ru".
//
// Decisions pinned here (FE-5 PR 1):
// - src/lib/components/home/FilterBar.svelte, props { active, onToggle,
//   onOpenFilters }; root data-testid="filter-bar". Controlled: it never
//   keeps filter state, it renders `active` and reports clicks.
// - The quick chips are the Chip primitive: toggle buttons with
//   aria-pressed. A press calls onToggle(id) (the screen navigates to
//   toggleFilterHref); nothing changes until `active` does.
// - The Filters button is a <button> named by its visible label ("Filters" /
//   "Filters · N"), with data-active="true" while N>0 (the ink fill). It is
//   not a toggle (no aria-pressed): it opens the sheet (PR 2).
// - The ru check runs at 320px: the 360px viewport minus the header's 20px
//   side padding.

const RU_ROW_WIDTH_PX = 320;
const ROOMY_ROW_WIDTH_PX = 600;

const baseGetLocale = getLocale;
afterEach(() => overwriteGetLocale(baseGetLocale));

type RenderSpec = {
	lang?: PopularLocale;
	active?: string[];
	width?: number;
	onToggle?: (id: string) => void;
	onOpenFilters?: () => void;
};

async function renderBar(spec: RenderSpec = {}): Promise<HTMLElement> {
	const lang = spec.lang ?? 'en';
	overwriteGetLocale(() => lang);
	const FilterBar = await loadHome<FilterBarProps>('FilterBar');
	const target = stage(`width: ${spec.width ?? ROOMY_ROW_WIDTH_PX}px; background: var(--bg-page)`);
	const props: FilterBarProps = {
		active: spec.active ?? [],
		onToggle: spec.onToggle ?? (() => {}),
		onOpenFilters: spec.onOpenFilters ?? (() => {})
	};
	render(FilterBar, { target, props });
	const root = target.querySelector<HTMLElement>(`[data-testid="${TEST_IDS.filterBar}"]`);
	expect(root, `got no [data-testid="${TEST_IDS.filterBar}"] root`).not.toBeNull();
	return root!;
}

const buttonsIn = (root: Element) => [...root.querySelectorAll<HTMLButtonElement>('button')];
const labelOf = (el: Element) => (el.textContent ?? '').replace(/\s+/g, ' ').trim();

function filtersButton(root: Element): HTMLButtonElement {
	const [first] = buttonsIn(root);
	expect(first, 'got no buttons in the filter bar').toBeDefined();
	return first;
}

function chip(
	root: Element,
	lang: PopularLocale,
	id: (typeof QUICK_IDS)[number]
): HTMLButtonElement {
	const label = POPULAR_COPY[lang].quick[id];
	const found = buttonsIn(root).find((b) => labelOf(b) === label);
	expect(found, `got no "${label}" chip`).toBeDefined();
	return found!;
}

// The element that scrolls: the closest common ancestor of the buttons.
function scrollRow(root: HTMLElement): HTMLElement {
	const [first, ...rest] = buttonsIn(root);
	let row: HTMLElement | null = first.parentElement;
	while (row && !rest.every((b) => row!.contains(b))) row = row.parentElement;
	expect(row, 'got no common row for the buttons').not.toBeNull();
	return row!;
}

describe('FilterBar: items and order', () => {
	for (const lang of ['en', 'es', 'ru'] as const) {
		it(`${lang}: the Filters button, then ${QUICK_IDS.join(', ')}`, async () => {
			const root = await renderBar({ lang });
			const copy = POPULAR_COPY[lang];
			const want = [copy.filters, ...QUICK_IDS.map((id) => copy.quick[id])];
			expect(buttonsIn(root).map(labelOf)).toEqual(want);
		});
	}

	it('every item is a type="button" (no form submits)', async () => {
		const root = await renderBar();
		for (const button of buttonsIn(root)) expect(button.getAttribute('type')).toBe('button');
	});

	it('has no sort control', async () => {
		const root = await renderBar();
		expect(root.querySelectorAll('select, [role="combobox"], [role="listbox"]').length).toBe(0);
		expect(buttonsIn(root).length, 'want the Filters button and four chips only').toBe(5);
	});
});

describe('FilterBar: the Filters button', () => {
	const cases: { lang: PopularLocale; active: string[] }[] = [
		{ lang: 'en', active: [] },
		{ lang: 'en', active: ['vegetarian'] },
		{ lang: 'en', active: ['vegetarian', 'summer'] },
		{ lang: 'es', active: ['pork', 'mains', 'winter'] },
		{ lang: 'ru', active: ['seafood'] }
	];
	for (const tc of cases) {
		const want = filtersLabel(tc.lang, tc.active.length);
		it(`${tc.lang} with ${tc.active.length} active: "${want}"`, async () => {
			const root = await renderBar(tc);
			expect(labelOf(filtersButton(root))).toBe(want);
		});
	}

	it('counts filters that have no quick chip ("Filters · 2" for pork + winter)', async () => {
		const root = await renderBar({ active: ['pork', 'winter'] });
		expect(labelOf(filtersButton(root))).toBe('Filters · 2');
	});

	it('is not a toggle: no aria-pressed', async () => {
		const root = await renderBar({ active: ['quick'] });
		expect(filtersButton(root).hasAttribute('aria-pressed')).toBe(false);
	});

	it(`${FILTERS_ACTIVE_ATTR}="true" only while a filter is active`, async () => {
		const off = filtersButton(await renderBar());
		expect(off.getAttribute(FILTERS_ACTIVE_ATTR), 'want no active marker with 0').not.toBe('true');
		const on = filtersButton(await renderBar({ active: ['desserts'] }));
		expect(on.getAttribute(FILTERS_ACTIVE_ATTR)).toBe('true');
	});

	it('a press calls onOpenFilters, not onToggle', async () => {
		const onOpenFilters = vi.fn();
		const onToggle = vi.fn();
		const root = await renderBar({ onOpenFilters, onToggle });
		await userEvent.click(filtersButton(root));
		expect(onOpenFilters).toHaveBeenCalledTimes(1);
		expect(onToggle).not.toHaveBeenCalled();
	});

	it('off: pill, padding 8px 13px, 12px/700, transparent, 1px --border-chip, ink text', async () => {
		const button = filtersButton(await renderBar());
		expect(style(button, 'padding')).toBe('8px 13px');
		expect(style(button, 'font-size')).toBe('12px');
		expect(style(button, 'font-weight')).toBe('700');
		expect(style(button, 'white-space')).toBe('nowrap');
		expect(style(button, 'border-top-left-radius')).toBe(
			computed('border-top-left-radius', 'var(--radius-pill)')
		);
		expect(style(button, 'background-color')).toBe('rgba(0, 0, 0, 0)');
		expect(style(button, 'border-top-width')).toBe('1px');
		expect(style(button, 'border-top-color')).toBe(computed('color', 'var(--border-chip)'));
		expect(style(button, 'color')).toBe(computed('color', 'var(--ink)'));
	});

	it('on (N>0): ink fill and border, --on-accent text', async () => {
		const button = filtersButton(await renderBar({ active: ['quick', 'summer'] }));
		expect(style(button, 'background-color')).toBe(computed('background-color', 'var(--ink)'));
		expect(style(button, 'border-top-color')).toBe(computed('color', 'var(--ink)'));
		expect(style(button, 'color')).toBe(computed('color', 'var(--on-accent)'));
	});
});

describe('FilterBar: quick chips follow `active` (the URL)', () => {
	it('no filter: every chip off', async () => {
		const root = await renderBar();
		for (const id of QUICK_IDS) {
			expect(chip(root, 'en', id).getAttribute('aria-pressed'), `${id}`).toBe('false');
		}
	});

	it('vegetarian and summer active: exactly those two chips pressed', async () => {
		const root = await renderBar({ active: ['vegetarian', 'summer'] });
		const pressed = QUICK_IDS.filter(
			(id) => chip(root, 'en', id).getAttribute('aria-pressed') === 'true'
		);
		expect(pressed).toEqual(['vegetarian', 'summer']);
	});

	it('a sheet-only filter (pork) presses no chip', async () => {
		const root = await renderBar({ active: ['pork'] });
		for (const id of QUICK_IDS) {
			expect(chip(root, 'en', id).getAttribute('aria-pressed'), `${id}`).toBe('false');
		}
	});

	it('a pressed chip is ink-filled with --on-accent text', async () => {
		const root = await renderBar({ active: ['desserts'] });
		const pressed = chip(root, 'en', 'desserts');
		expect(style(pressed, 'background-color')).toBe(computed('background-color', 'var(--ink)'));
		expect(style(pressed, 'color')).toBe(computed('color', 'var(--on-accent)'));
	});

	for (const id of QUICK_IDS) {
		it(`pressing ${id} calls onToggle("${id}") once`, async () => {
			const onToggle = vi.fn();
			const root = await renderBar({ onToggle });
			await userEvent.click(chip(root, 'en', id));
			expect(onToggle.mock.calls).toEqual([[id]]);
		});
	}

	it('pressing an active chip asks to toggle it off, the same call', async () => {
		const onToggle = vi.fn();
		const root = await renderBar({ active: ['quick'], onToggle });
		await userEvent.click(chip(root, 'en', 'quick'));
		expect(onToggle.mock.calls).toEqual([['quick']]);
	});

	it('controlled: a press does not change the chip until `active` changes', async () => {
		const root = await renderBar();
		const vegetarian = chip(root, 'en', 'vegetarian');
		await userEvent.click(vegetarian);
		expect(vegetarian.getAttribute('aria-pressed')).toBe('false');
	});
});

describe('FilterBar: one scrolling row (ru at 360px)', () => {
	it('the row scrolls sideways, gap 7px, scrollbar hidden', async () => {
		const row = scrollRow(await renderBar({ lang: 'ru', width: RU_ROW_WIDTH_PX }));
		expect(['auto', 'scroll'], `got overflow-x ${style(row, 'overflow-x')}`).toContain(
			style(row, 'overflow-x')
		);
		expect(style(row, 'flex-wrap')).toBe('nowrap');
		expect(style(row, 'column-gap')).toBe('7px');
		expect(style(row, 'scrollbar-width')).toBe('none');
		expect(row.offsetHeight - row.clientHeight, 'got a visible horizontal scrollbar').toBe(0);
	});

	it('ru: every label in full on one line (no ellipsis, nothing clipped)', async () => {
		const root = await renderBar({ lang: 'ru', width: RU_ROW_WIDTH_PX, active: ['quick'] });
		const copy = POPULAR_COPY.ru;
		const labels = [filtersLabel('ru', 1), ...QUICK_IDS.map((id) => copy.quick[id])];
		buttonsIn(root).forEach((button, i) => {
			expectFullyVisible(button, labels[i]);
			expect(textLineCount(button), `got "${labels[i]}" wrapped`).toBe(1);
		});
	});

	it('ru: the row is wider than 320px, and scrolling to the end shows the last chip whole', async () => {
		const root = await renderBar({ lang: 'ru', width: RU_ROW_WIDTH_PX });
		const row = scrollRow(root);
		expect(row.scrollWidth, 'want the ru row to overflow at 320px').toBeGreaterThan(
			row.clientWidth
		);
		row.scrollLeft = row.scrollWidth;
		const last = chip(root, 'ru', 'summer').getBoundingClientRect();
		const box = row.getBoundingClientRect();
		expect(last.right, 'got the last chip cut at the row end').toBeLessThanOrEqual(box.right + 0.5);
		expect(last.left, 'got the last chip outside the row').toBeGreaterThanOrEqual(box.left - 0.5);
	});

	it('the overflow stays inside the row: the page does not scroll sideways', async () => {
		await renderBar({ lang: 'ru', width: RU_ROW_WIDTH_PX });
		const page = document.documentElement;
		expect(page.scrollWidth, 'got the chips widening the page').toBeLessThanOrEqual(
			page.clientWidth
		);
	});
});
