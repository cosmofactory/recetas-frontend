import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { userEvent } from 'vitest/browser';
import { getLocale, overwriteGetLocale } from '#lib/paraglide/runtime.js';
import type { FilterGroupsProps } from '../../testutil/popular';
import {
	FILTER_IDS,
	GROUP_IDS,
	GROUP_KEYS,
	POPULAR_LOCALES,
	SHEET_COPY,
	TEST_IDS,
	type FilterIdCopy,
	type GroupKey,
	type PopularLocale
} from '../../testutil/popular-copy';
import {
	computed,
	expectFullyVisible,
	loadContent,
	stage,
	style,
	textContrast,
	textLineCount,
	useViewport
} from '../../testutil/ui';

// FE-5 PR 2, FilterGroups: the four filter groups of the mobile Filters sheet
// (and, in PR 3, of the desktop filter sidebar). A content component
// (src/lib/content/): data and callbacks only, never a container; the screen
// wraps it in OverlaySheet (mobile) or the sidebar (desktop).
//
// Sources, by line:
// - Mobile README -> Filters sheet L102–111: "Four groups, each an eyebrow
//   label (10px/700, .11em, ink-4) + wrapping chip row (gap 7px): Diet:
//   Vegetarian, Seafood, With pork · Course: Tapas, Mains, Desserts ·
//   Effort: Quick, Slow-cooked · Season: Summer, Winter, Holy Week, All
//   year. Logic: OR within a group, AND across groups. The quick chips on
//   the bar are the same filters (they stay in sync)."
// - Mobile prototype (Asadorov Explorations.dc.html, 2a) L317–348: each
//   group is "display:flex;flex-direction:column;gap:7px"; the eyebrow is
//   uppercase; the chips are the filter bar's ("padding:8px 13px ...
//   font-size:12px;font-weight:600"); the groups sit in the sheet's column
//   with its gap of 14px.
// - Desktop README -> Popular: the sidebar shows "all four groups always
//   visible as wrapping chips" (stage FE-5: the same FilterGroups).
// - Contrast (stack.md X10): ink-4 (.45) is about 3:1 on --bg-surface, under
//   AA for 10px text, so the eyebrow needs an AA colour (the layout.css
//   overrides; --ink-eyebrow is the existing eyebrow one).
//
// Decisions pinned here (FE-5 PR 2):
// - src/lib/content/FilterGroups.svelte, props { active, onToggle } (as
//   FilterBar): controlled, it keeps no filter state. Root
//   data-testid="filter-groups". Groups and chips come from FILTER_GROUPS
//   (#lib/popular/filters.ts), labels from filterLabel.
// - Each group is a labelled group (role="group" named by its visible
//   eyebrow, or a <fieldset> with a <legend>), so a screen reader hears
//   "Diet, group" before its chips (WCAG 1.3.1).
// - Every chip is the Chip primitive: a toggle button with aria-pressed. A
//   press calls onToggle(id); the screen navigates to toggleFilterHref, the
//   same as a quick chip, which is what keeps both in sync.
// - The only focusable elements are the twelve chips.
// - Layout at < 860px: the groups stack with a 14px gap (the sheet's).

const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]';
const GROUP_SELECTOR = '[role="group"], fieldset';
// The Filters sheet is the screen width minus its 20px side padding.
const SHEET_CONTENT_WIDTH_PX: Record<number, number> = { 390: 350, 360: 320 };
const MIN_TEXT_CONTRAST = 4.5;

const baseGetLocale = getLocale;
afterEach(() => overwriteGetLocale(baseGetLocale));

type RenderSpec = {
	lang?: PopularLocale;
	active?: string[];
	width?: number;
	onToggle?: (id: string) => void;
};

async function renderGroups(spec: RenderSpec = {}): Promise<HTMLElement> {
	const lang = spec.lang ?? 'en';
	overwriteGetLocale(() => lang);
	const FilterGroups = await loadContent<FilterGroupsProps>('FilterGroups');
	const width = spec.width ?? SHEET_CONTENT_WIDTH_PX[390];
	const target = stage(`width: ${width}px; background: var(--bg-surface)`);
	const props: FilterGroupsProps = {
		active: spec.active ?? [],
		onToggle: spec.onToggle ?? (() => {})
	};
	render(FilterGroups, { target, props });
	const root = target.querySelector<HTMLElement>(`[data-testid="${TEST_IDS.filterGroups}"]`);
	expect(root, `got no [data-testid="${TEST_IDS.filterGroups}"] root`).not.toBeNull();
	return root!;
}

const labelOf = (el: Element) => (el.textContent ?? '').replace(/\s+/g, ' ').trim();

// A group's accessible name: aria-labelledby, aria-label, or its <legend>.
function groupName(group: Element): string {
	const ids = group.getAttribute('aria-labelledby');
	if (ids) {
		return ids
			.split(/\s+/)
			.map((id) => labelOf(document.getElementById(id) ?? document.createElement('i')))
			.join(' ');
	}
	const legend = group.tagName === 'FIELDSET' ? group.querySelector('legend') : null;
	return group.getAttribute('aria-label') ?? (legend ? labelOf(legend) : '');
}

function groupsIn(root: Element): HTMLElement[] {
	return [...root.querySelectorAll<HTMLElement>(GROUP_SELECTOR)];
}

function group(root: Element, lang: PopularLocale, key: GroupKey): HTMLElement {
	const name = SHEET_COPY[lang].groups[key];
	const found = groupsIn(root).find((g) => groupName(g) === name);
	expect(found, `got no group named "${name}"`).toBeDefined();
	return found!;
}

const chipsIn = (el: Element) => [...el.querySelectorAll<HTMLButtonElement>('button')];

function chip(root: Element, lang: PopularLocale, id: FilterIdCopy): HTMLButtonElement {
	const label = SHEET_COPY[lang].labels[id];
	const found = chipsIn(root).find((b) => labelOf(b) === label);
	expect(found, `got no "${label}" chip`).toBeDefined();
	return found!;
}

// The visible eyebrow of a group: its labelling element (or legend).
function eyebrowOf(root: Element, lang: PopularLocale, key: GroupKey): HTMLElement {
	const g = group(root, lang, key);
	const id = g.getAttribute('aria-labelledby')?.split(/\s+/)[0];
	const label = id ? document.getElementById(id) : g.querySelector('legend');
	expect(label, `got no visible eyebrow for the ${key} group`).not.toBeNull();
	return label as HTMLElement;
}

function pressedIds(root: Element): FilterIdCopy[] {
	return FILTER_IDS.filter((id) => chip(root, 'en', id).getAttribute('aria-pressed') === 'true');
}

describe('FilterGroups: the four groups and their chips', () => {
	for (const lang of POPULAR_LOCALES) {
		const copy = SHEET_COPY[lang];

		it(`${lang}: four labelled groups, ${GROUP_KEYS.map((k) => copy.groups[k]).join(', ')}`, async () => {
			const root = await renderGroups({ lang });
			expect(groupsIn(root).map(groupName)).toEqual(GROUP_KEYS.map((key) => copy.groups[key]));
		});

		it(`${lang}: each group holds its chips, in the README order`, async () => {
			const root = await renderGroups({ lang });
			for (const key of GROUP_KEYS) {
				const want = GROUP_IDS[key].map((id) => copy.labels[id]);
				expect(chipsIn(group(root, lang, key)).map(labelOf), `${key}`).toEqual(want);
			}
		});

		it(`${lang}: the eyebrow shows the group label`, async () => {
			const root = await renderGroups({ lang });
			for (const key of GROUP_KEYS) {
				expect(labelOf(eyebrowOf(root, lang, key))).toBe(copy.groups[key]);
			}
		});
	}

	it('twelve chips in all, each a type="button" toggle with aria-pressed', async () => {
		const root = await renderGroups();
		const chips = chipsIn(root);
		expect(chips.length).toBe(FILTER_IDS.length);
		for (const button of chips) {
			expect(button.getAttribute('type'), labelOf(button)).toBe('button');
			expect(['true', 'false'], labelOf(button)).toContain(button.getAttribute('aria-pressed'));
		}
	});

	it('the chips are the only focusable elements', async () => {
		const root = await renderGroups();
		const focusable = [...root.querySelectorAll(FOCUSABLE)];
		expect(focusable.length, `got ${focusable.length} focusable, want the 12 chips`).toBe(
			FILTER_IDS.length
		);
	});

	it('has no sort control and no count', async () => {
		const root = await renderGroups({ active: ['quick'] });
		expect(root.querySelectorAll('select, [role="combobox"], [role="listbox"]').length).toBe(0);
		expect(labelOf(root), 'got a number in the groups').not.toMatch(/\d/);
	});
});

describe('FilterGroups: chips follow `active` (the URL)', () => {
	const cases: { name: string; active: string[]; want: FilterIdCopy[] }[] = [
		{ name: 'nothing active', active: [], want: [] },
		{
			name: 'one per group',
			active: ['pork', 'mains', 'slow-cooked', 'winter'],
			want: ['pork', 'mains', 'slow-cooked', 'winter']
		},
		{
			name: 'two in one group',
			active: ['vegetarian', 'seafood'],
			want: ['vegetarian', 'seafood']
		},
		{
			name: 'the quick-chip filters',
			active: ['vegetarian', 'quick', 'desserts', 'summer'],
			want: ['vegetarian', 'desserts', 'quick', 'summer']
		},
		{
			name: 'All year and Holy Week',
			active: ['all-year', 'easter'],
			want: ['easter', 'all-year']
		},
		{ name: 'every filter', active: [...FILTER_IDS], want: [...FILTER_IDS] },
		{ name: 'unknown ids ignored', active: ['vegan', 'summer'], want: ['summer'] }
	];
	for (const tc of cases) {
		it(`${tc.name}: exactly ${tc.want.join(', ') || 'none'} pressed`, async () => {
			const root = await renderGroups({ active: tc.active });
			expect(pressedIds(root)).toEqual(tc.want);
		});
	}

	it('a pressed chip is ink-filled with --on-accent text, an unpressed one transparent', async () => {
		const root = await renderGroups({ active: ['seafood'] });
		const on = chip(root, 'en', 'seafood');
		const off = chip(root, 'en', 'pork');
		expect(style(on, 'background-color')).toBe(computed('background-color', 'var(--ink)'));
		expect(style(on, 'color')).toBe(computed('color', 'var(--on-accent)'));
		expect(style(off, 'background-color')).toBe('rgba(0, 0, 0, 0)');
		expect(style(off, 'border-top-color')).toBe(computed('color', 'var(--border-chip)'));
	});
});

describe('FilterGroups: a press asks the screen to toggle', () => {
	for (const id of FILTER_IDS) {
		it(`pressing ${id} calls onToggle("${id}") once`, async () => {
			const onToggle = vi.fn();
			const root = await renderGroups({ onToggle });
			await userEvent.click(chip(root, 'en', id));
			expect(onToggle.mock.calls).toEqual([[id]]);
		});
	}

	it('pressing an active chip asks to toggle it off, the same call', async () => {
		const onToggle = vi.fn();
		const root = await renderGroups({ active: ['winter'], onToggle });
		await userEvent.click(chip(root, 'en', 'winter'));
		expect(onToggle.mock.calls).toEqual([['winter']]);
	});

	it('controlled: a press does not change the chip until `active` changes', async () => {
		const root = await renderGroups();
		const tapas = chip(root, 'en', 'tapas');
		await userEvent.click(tapas);
		expect(tapas.getAttribute('aria-pressed')).toBe('false');
	});
});

describe('FilterGroups: mobile sheet styles (< 860px)', () => {
	useViewport(390, 844);

	it('the groups stack in a column, 14px apart', async () => {
		const root = await renderGroups();
		const [first, second] = groupsIn(root);
		const gap = second.getBoundingClientRect().top - first.getBoundingClientRect().bottom;
		expect(Math.abs(gap - 14), `got ${gap}px between groups, want 14px`).toBeLessThanOrEqual(0.5);
	});

	it('a group: eyebrow above its chips, 7px apart', async () => {
		const root = await renderGroups();
		const eyebrow = eyebrowOf(root, 'en', 'diet');
		const [firstChip] = chipsIn(group(root, 'en', 'diet'));
		const gap = firstChip.getBoundingClientRect().top - eyebrow.getBoundingClientRect().bottom;
		expect(Math.abs(gap - 7), `got ${gap}px under the eyebrow, want 7px`).toBeLessThanOrEqual(0.5);
	});

	it('eyebrow: 10px/700, letter-spacing .11em, uppercase', async () => {
		const root = await renderGroups();
		const eyebrow = eyebrowOf(root, 'en', 'season');
		expect(style(eyebrow, 'font-size')).toBe('10px');
		expect(style(eyebrow, 'font-weight')).toBe('700');
		expect(style(eyebrow, 'letter-spacing')).toBe('1.1px');
		expect(style(eyebrow, 'text-transform')).toBe('uppercase');
	});

	it(`eyebrow text passes AA (≥ ${MIN_TEXT_CONTRAST}:1) on --bg-surface`, async () => {
		const root = await renderGroups();
		const surface = computed('background-color', 'var(--bg-surface)');
		for (const key of GROUP_KEYS) {
			const ratio = textContrast(eyebrowOf(root, 'en', key), surface);
			expect(ratio, `got ${ratio.toFixed(2)}:1 for the ${key} eyebrow`).toBeGreaterThanOrEqual(
				MIN_TEXT_CONTRAST
			);
		}
	});

	it('a chip row wraps, with a 7px gap both ways', async () => {
		const root = await renderGroups({ lang: 'ru', width: SHEET_CONTENT_WIDTH_PX[360] });
		const chips = chipsIn(group(root, 'ru', 'season'));
		const row = chips[0].parentElement!;
		expect(
			chips.every((c) => c.parentElement === row),
			'want the chips in one row element'
		).toBe(true);
		expect(style(row, 'flex-wrap')).toBe('wrap');
		expect(style(row, 'column-gap')).toBe('7px');
		expect(style(row, 'row-gap')).toBe('7px');
	});

	it('chips: the filter-bar chip (padding 8px 13px, 12px/600, pill)', async () => {
		const root = await renderGroups();
		const button = chip(root, 'en', 'mains');
		expect(style(button, 'padding')).toBe('8px 13px');
		expect(style(button, 'font-size')).toBe('12px');
		expect(style(button, 'font-weight')).toBe('600');
		expect(style(button, 'border-top-left-radius')).toBe(
			computed('border-top-left-radius', 'var(--radius-pill)')
		);
	});

	it('ru at 360px: chips wrap onto lines, every label whole on one line', async () => {
		const root = await renderGroups({ lang: 'ru', width: SHEET_CONTENT_WIDTH_PX[360] });
		for (const id of FILTER_IDS) {
			const button = chip(root, 'ru', id);
			expectFullyVisible(button, SHEET_COPY.ru.labels[id]);
			expect(textLineCount(button), `got "${SHEET_COPY.ru.labels[id]}" wrapped`).toBe(1);
		}
		const box = root.getBoundingClientRect();
		for (const button of chipsIn(root)) {
			const rect = button.getBoundingClientRect();
			expect(rect.right, `got "${labelOf(button)}" past the sheet edge`).toBeLessThanOrEqual(
				box.right + 0.5
			);
		}
	});
});
