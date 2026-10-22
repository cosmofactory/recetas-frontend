import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page, userEvent } from 'vitest/browser';
import { getLocale, overwriteGetLocale } from '#lib/paraglide/runtime.js';
import { nothingFor, SEARCH_COPY } from '../../../testutil/search-copy';
import {
	activeOption,
	activeTitle,
	focusedInput,
	groupNames,
	LONG_SUBTITLE_DISHES,
	optionTitled,
	optionTitles,
	options,
	partOf,
	renderSearch,
	searchDialog,
	searchInput,
	selectedOptions,
	textIn,
	typeQuery
} from '../../../testutil/search-overlay';
import { content, focusIsIn, landsOn, screenFrame, settle } from '../../../testutil/sheet';
import {
	animates,
	computed,
	emulateReducedMotion,
	hitArea,
	loadUi,
	resetEmulatedMedia,
	style,
	transitionDuration,
	transitionTimingFunction,
	useViewport
} from '../../../testutil/ui';

// FE-7 PR 2, SearchOverlay: the mobile search overlay (< 860px).
//
// Sources:
// - Mobile README -> Overlay — Search (L172–183): "Full-screen, above
//   everything. Enter: opacity 0 → 1 (250ms) and translateY 24px → 0 (350ms
//   --ease). Input auto-focuses after the transition." Top row: field 46px
//   pill with placeholder, a 22px "×" clear button "when there's text", then
//   "Cancel" (accent) — "closes and clears". Empty query: "TRY" eyebrow +
//   chips ("tap fills the query"). Results grouped Dishes → Variations →
//   Regions; row: "40px thumb (radius 9px; regions 10px), title (Instrument
//   Serif 18px), sub (11.5px ink-3, ellipsis), chevron". No results:
//   "Nothing for "query"" + hint.
// - Prototype Search.dc.html: the page background (#F6EFE3 = --bg-page);
//   showTry is `!norm(q.trim())`, so a whitespace query still shows the
//   chips and never the no-results block; hasQuery is `!!q` (the "×" shows
//   for any text); clear refocuses the input; closing clears the query
//   (componentDidUpdate); the region thumb is its tile colour, the others
//   the striped placeholder; `{t.nothing} “{query}”`.
// - Accessibility (README + CLAUDE.md): a modal dialog with a focus trap,
//   Escape closes (escape-layers.ts, topmost only), focus returns to the
//   opener; reduced motion swaps the slide for a fade (motionFor).
// - Stage FE-7: arrow keys move through results, Enter selects.
//
// Decisions pinned here (FE-7 PR 2):
// - src/lib/components/search/SearchOverlay.svelte, props { open, index,
//   onClose, onSelect } (testutil/search-overlay.ts). Controlled: the screen
//   owns `open`; the query is the overlay's own in-memory state.
// - ARIA: the dialog is named by a11y.search ("Search"). The field is an
//   <input role="combobox"> named "Search", aria-autocomplete="list",
//   aria-expanded only while results show, aria-controls its listbox. One
//   role="listbox" holds a role="group" per result group, named by its
//   visible heading (aria-labelledby). Rows are role="option" with ids; the
//   active one is aria-activedescendant on the input and aria-selected.
//   Focus never leaves the input while moving (the APG "list autocomplete"
//   combobox; PR 4's desktop dropdown reuses the same listbox).
// - Arrow keys run across group boundaries in display order; typing resets
//   the active option; Enter without one selects nothing.
// - The suggestion chips and the clear "×" are buttons; the "×" is named
//   a11y.clearSearch ("Clear search", new extra-strings copy).
// - A search overlay stacks above the Filters OverlaySheet, and Escape there
//   closes only the search (a layer kind above `overlay`).

type OverlaySheetProps = {
	open: boolean;
	onClose: () => void;
	label: string;
	children: ReturnType<typeof content>;
};

const FADE_DURATION = '0.25s';
const SLIDE_DURATION = '0.35s';
const ENTER_OFFSET_PX = 24;
const THUMB_PX = 40;
const VIEWPORT = { width: 390, height: 844 };

const baseGetLocale = getLocale;
afterEach(() => overwriteGetLocale(baseGetLocale));

// The translateY of a computed transform (0 for none).
function translateY(el: HTMLElement): number {
	const transform = style(el, 'transform');
	return transform === 'none' ? 0 : new DOMMatrixReadOnly(transform).m42;
}

async function openWithResults(query: string) {
	const rendered = await renderSearch();
	const input = await focusedInput(rendered.frame);
	await typeQuery(rendered.frame, query);
	return { ...rendered, input };
}

describe('SearchOverlay layout', () => {
	useViewport(VIEWPORT.width, VIEWPORT.height);

	it('covers the whole screen when open', async () => {
		const { frame } = await renderSearch();
		const { left, top, width, height } = searchDialog(frame).getBoundingClientRect();
		expect({ left, top, width, height }).toEqual({ left: 0, top: 0, ...VIEWPORT });
	});

	it('is painted with --bg-page', async () => {
		const { frame } = await renderSearch();
		const want = computed('background-color', 'var(--bg-page)');
		expect(style(searchDialog(frame), 'background-color')).toBe(want);
	});

	it('takes taps everywhere on screen when open', async () => {
		const { frame } = await renderSearch();
		const dialog = searchDialog(frame);
		for (const [x, y] of [
			[10, 10],
			[195, 422],
			[380, 834]
		]) {
			expect(landsOn(dialog, x, y), `got a tap at ${x},${y} missing the overlay`).toBe(true);
		}
	});

	it('is drawn above the open Filters sheet, whatever the DOM order', async () => {
		const frame = screenFrame();
		await renderSearch({ frame });
		const OverlaySheet = await loadUi<OverlaySheetProps>('OverlaySheet');
		await render(OverlaySheet, {
			target: frame,
			props: { open: true, onClose: vi.fn(), label: 'Filters', children: content() }
		});
		settle();
		const dialog = page.getByRole('dialog', { name: 'Search', exact: true }).element();
		expect(landsOn(dialog, 195, 830), 'want the search overlay over the filters sheet').toBe(true);
	});

	it('has a 46px field', async () => {
		const { frame } = await renderSearch();
		const field = searchDialog(frame).querySelector('[data-testid="search-field"]');
		expect(field, 'got no data-testid="search-field"').not.toBeNull();
		expect(field!.getBoundingClientRect().height).toBeCloseTo(46, 0);
	});
});

describe('SearchOverlay motion', () => {
	useViewport(VIEWPORT.width, VIEWPORT.height);
	afterEach(resetEmulatedMedia);

	it(`fades its opacity over ${FADE_DURATION}`, async () => {
		const { frame } = await renderSearch();
		expect(transitionDuration(searchDialog(frame), 'opacity')).toBe(FADE_DURATION);
	});

	it(`slides its transform over ${SLIDE_DURATION} with --ease`, async () => {
		const { frame } = await renderSearch();
		const dialog = searchDialog(frame);
		expect(transitionDuration(dialog, 'transform')).toBe(SLIDE_DURATION);
		const ease = computed('transition-timing-function', 'var(--ease)');
		expect(transitionTimingFunction(dialog, 'transform')).toBe(ease);
	});

	it(`rests transparent and ${ENTER_OFFSET_PX}px low when closed`, async () => {
		const { frame } = await renderSearch({ open: false });
		const dialog = searchDialog(frame);
		expect(style(dialog, 'opacity')).toBe('0');
		expect(translateY(dialog)).toBeCloseTo(ENTER_OFFSET_PX, 1);
	});

	it('rests opaque and in place when open', async () => {
		const { frame, setOpen } = await renderSearch({ open: false });
		await setOpen(true);
		const dialog = searchDialog(frame);
		expect(style(dialog, 'opacity')).toBe('1');
		expect(translateY(dialog)).toBeCloseTo(0, 1);
	});

	it('only fades under prefers-reduced-motion', async () => {
		await emulateReducedMotion('reduce');
		const { frame } = await renderSearch();
		const dialog = searchDialog(frame);
		expect(animates(dialog, 'transform'), 'got a transform transition').toBe(false);
		expect(transitionDuration(dialog, 'opacity')).toBe(FADE_DURATION);
	});
});

describe('SearchOverlay focus and dialog', () => {
	useViewport(VIEWPORT.width, VIEWPORT.height);
	afterEach(resetEmulatedMedia);

	it('is a modal dialog named "Search" when open', async () => {
		await renderSearch();
		const dialog = page.getByRole('dialog', { name: 'Search', exact: true });
		await expect.element(dialog).toBeInTheDocument();
		expect(dialog.element().getAttribute('aria-modal')).toBe('true');
	});

	it('is inert and hidden when closed', async () => {
		const { frame } = await renderSearch({ open: false });
		const dialog = searchDialog(frame);
		expect(dialog.closest('[inert]'), 'want the closed overlay inert').not.toBeNull();
		expect(
			dialog.checkVisibility({ visibilityProperty: true }),
			'got a visible closed overlay'
		).toBe(false);
	});

	it('focuses the field only after the enter transition', async () => {
		const { frame, opener, startOpen } = await renderSearch({ open: false });
		opener.focus();
		await startOpen(true);
		const input = searchInput(frame);
		expect(document.activeElement, 'got the field focused mid-transition').not.toBe(input);
		await expect.poll(() => document.activeElement, { timeout: 2000 }).toBe(input);
	});

	it('focuses the field under reduced motion too', async () => {
		await emulateReducedMotion('reduce');
		const { frame, opener, startOpen } = await renderSearch({ open: false });
		opener.focus();
		await startOpen(true);
		await focusedInput(frame);
	});

	it('shows the placeholder and names the field "Search"', async () => {
		const { frame, copy } = await renderSearch();
		expect(searchInput(frame).placeholder).toBe(copy.placeholder);
		await expect.element(page.getByRole('combobox', { name: 'Search', exact: true })).toBeVisible();
	});

	it('traps Tab inside the dialog', async () => {
		const { frame } = await renderSearch();
		const dialog = searchDialog(frame);
		await focusedInput(frame);
		for (let i = 0; i < 4; i++) {
			await userEvent.tab();
			expect(focusIsIn(dialog), `got Tab ${i + 1} leaving the dialog`).toBe(true);
		}
		await userEvent.tab({ shift: true });
		expect(focusIsIn(dialog), 'got Shift+Tab leaving the dialog').toBe(true);
	});

	it('asks to close on Escape', async () => {
		const { frame, onClose } = await renderSearch();
		await focusedInput(frame);
		await userEvent.keyboard('{Escape}');
		expect(onClose, 'want one onClose call').toHaveBeenCalledTimes(1);
	});

	it('returns focus to the opener once closed', async () => {
		const { frame, opener, startOpen, setOpen } = await renderSearch({ open: false });
		opener.focus();
		await startOpen(true);
		await focusedInput(frame);
		await userEvent.keyboard('{Escape}');
		await setOpen(false);
		await expect.poll(() => document.activeElement, { timeout: 1000 }).toBe(opener);
	});

	it('closes only itself on Escape when above the Filters sheet', async () => {
		const frame = screenFrame();
		const filtersClose = vi.fn();
		const OverlaySheet = await loadUi<OverlaySheetProps>('OverlaySheet');
		await render(OverlaySheet, {
			target: frame,
			props: { open: true, onClose: filtersClose, label: 'Filters', children: content() }
		});
		const { onClose } = await renderSearch({ frame });
		await focusedInput(frame);
		await userEvent.keyboard('{Escape}');
		expect(onClose, 'want the search to close').toHaveBeenCalledTimes(1);
		expect(filtersClose, 'got the filters sheet closing too').not.toHaveBeenCalled();
	});
});

describe('SearchOverlay field', () => {
	useViewport(VIEWPORT.width, VIEWPORT.height);

	const clearButton = () => page.getByRole('button', { name: 'Clear search', exact: true });

	it('has no clear button while the field is empty', async () => {
		await renderSearch();
		await expect.element(clearButton()).not.toBeInTheDocument();
	});

	it('shows a 22px clear button with a 44px hit area once there is text', async () => {
		const { frame } = await renderSearch();
		await focusedInput(frame);
		await typeQuery(frame, 'tor');
		const button = clearButton().element();
		const { width, height } = button.getBoundingClientRect();
		expect({ width, height }).toEqual({ width: 22, height: 22 });
		const hit = hitArea(button);
		expect(hit.width, 'got a narrow hit area').toBeGreaterThanOrEqual(44);
		expect(hit.height, 'got a short hit area').toBeGreaterThanOrEqual(44);
	});

	it('clears the query and keeps focus in the field', async () => {
		const { frame, input, copy } = await openWithResults('tortilla');
		await clearButton().click();
		expect(input.value).toBe('');
		expect(document.activeElement, 'want focus back in the field').toBe(input);
		expect(textIn(frame, copy.try), 'want the suggestions again').toBeDefined();
		await expect.element(clearButton()).not.toBeInTheDocument();
	});

	it('asks to close on Cancel', async () => {
		const { onClose, copy } = await renderSearch();
		await page.getByRole('button', { name: copy.cancel, exact: true }).click();
		expect(onClose, 'want one onClose call').toHaveBeenCalledTimes(1);
	});

	it('draws Cancel in --accent-text', async () => {
		const { copy } = await renderSearch();
		const cancel = page.getByRole('button', { name: copy.cancel, exact: true }).element();
		expect(style(cancel, 'color')).toBe(computed('color', 'var(--accent-text)'));
	});

	it('forgets the query once closed', async () => {
		const { frame, setOpen, copy } = await openWithResults('tortilla');
		await setOpen(false);
		await setOpen(true);
		expect(searchInput(frame).value, 'got the old query back').toBe('');
		expect(textIn(frame, copy.try), 'want the suggestions').toBeDefined();
	});
});

describe('SearchOverlay empty query', () => {
	useViewport(VIEWPORT.width, VIEWPORT.height);

	it('shows the TRY eyebrow in upper case', async () => {
		const { frame, copy } = await renderSearch();
		const eyebrow = textIn(frame, copy.try);
		expect(eyebrow, `got no "${copy.try}" eyebrow`).toBeDefined();
		expect(style(eyebrow!, 'text-transform')).toBe('uppercase');
	});

	for (const lang of ['en', 'ru'] as const) {
		it(`offers the ${lang} suggestion chips in order`, async () => {
			const { frame } = await renderSearch({ lang });
			const buttons = [...searchDialog(frame).querySelectorAll('button')];
			const labels = buttons.map((b) => b.textContent?.trim());
			const want = SEARCH_COPY[lang].suggestions;
			expect(
				labels.filter((l) => want.includes(l ?? '')),
				`got buttons ${JSON.stringify(labels)}`
			).toEqual(want);
		});
	}

	it('fills the query from a chip and shows its results', async () => {
		const { frame, copy } = await renderSearch();
		await focusedInput(frame);
		await page.getByRole('button', { name: 'Galicia', exact: true }).click();
		expect(searchInput(frame).value).toBe('Galicia');
		expect(optionTitles(frame)).toContain('Galicia');
		expect(textIn(frame, copy.try), 'got the suggestions over results').toBeUndefined();
	});

	it('shows no listbox and no "nothing" block', async () => {
		const { frame } = await renderSearch();
		expect(options(frame)).toEqual([]);
		expect(searchInput(frame).getAttribute('aria-expanded')).toBe('false');
		expect(searchDialog(frame).textContent).not.toContain('Nothing for');
	});

	it('keeps the suggestions for a whitespace-only query', async () => {
		const { frame, copy } = await renderSearch();
		await focusedInput(frame);
		await typeQuery(frame, '   ');
		expect(textIn(frame, copy.try), 'want the suggestions').toBeDefined();
		expect(searchDialog(frame).textContent).not.toContain(copy.nothing);
	});
});

describe('SearchOverlay results', () => {
	useViewport(VIEWPORT.width, VIEWPORT.height);

	it('groups results under Dishes, Variations, Regions headings', async () => {
		const { frame } = await openWithResults('a');
		expect(groupNames(frame)).toEqual(['Dishes', 'Variations', 'Regions']);
	});

	it('names the groups in the page language', async () => {
		const { frame } = await renderSearch({ lang: 'ru' });
		await focusedInput(frame);
		await typeQuery(frame, 'a');
		expect(groupNames(frame)).toEqual(SEARCH_COPY.ru.groups);
	});

	it('hides empty groups', async () => {
		const { frame } = await openWithResults('galicia');
		expect(groupNames(frame)).toEqual(['Variations', 'Regions']);
	});

	it('lists rows in search order: dish, then its variations', async () => {
		const { frame } = await openWithResults('tortilla');
		expect(optionTitles(frame)).toEqual([
			'Tortilla de patatas',
			'Betanzos-style runny',
			'Sacromonte'
		]);
	});

	it('finds a variation by its description', async () => {
		const { frame } = await openWithResults('onion');
		expect(optionTitles(frame)).toEqual(['Sacromonte']);
	});

	it('ignores accents', async () => {
		const { frame } = await openWithResults('andalucia');
		expect(optionTitles(frame)).toContain('Andalucía');
	});

	it('shows each row subtitle', async () => {
		const { frame } = await openWithResults('tortilla');
		const subtitles = options(frame).map((o) => partOf(o, 'subtitle').textContent?.trim());
		expect(subtitles).toEqual([
			'2 variations',
			'Galicia · Tortilla de patatas',
			'Andalucía · Tortilla de patatas'
		]);
	});

	it('expands the combobox and points it at the listbox', async () => {
		const { frame, input } = await openWithResults('tortilla');
		expect(input.getAttribute('aria-expanded')).toBe('true');
		expect(input.getAttribute('aria-autocomplete')).toBe('list');
		const listbox = document.getElementById(input.getAttribute('aria-controls') ?? '');
		expect(listbox?.getAttribute('role'), 'aria-controls must name the listbox').toBe('listbox');
		expect(options(frame).every((o) => listbox!.contains(o))).toBe(true);
	});

	it('gives every option a unique id', async () => {
		const { frame } = await openWithResults('a');
		const ids = options(frame).map((o) => o.id);
		expect(ids.every(Boolean), 'got an option without an id').toBe(true);
		expect(new Set(ids).size).toBe(ids.length);
	});
});

describe('SearchOverlay result rows', () => {
	useViewport(VIEWPORT.width, VIEWPORT.height);

	it(`has a ${THUMB_PX}px thumbnail rounded 9px for dishes and variations`, async () => {
		const { frame } = await openWithResults('tortilla');
		for (const option of options(frame)) {
			const thumb = partOf(option, 'thumb');
			const { width, height } = thumb.getBoundingClientRect();
			expect({ width, height }).toEqual({ width: THUMB_PX, height: THUMB_PX });
			expect(style(thumb, 'border-top-left-radius')).toBe('9px');
		}
	});

	it('draws the dish and variation thumbnail as the --placeholder stripes', async () => {
		const { frame } = await openWithResults('tortilla');
		const want = computed('background-image', 'var(--placeholder)');
		const thumb = partOf(optionTitled(frame, 'Tortilla de patatas'), 'thumb');
		expect(style(thumb, 'background-image')).toBe(want);
	});

	it('fills a region thumbnail with its tile colour, rounded 10px', async () => {
		const { frame } = await openWithResults('galicia');
		const thumb = partOf(optionTitled(frame, 'Galicia'), 'thumb');
		expect(style(thumb, 'background-color')).toBe('rgb(154, 154, 94)');
		expect(style(thumb, 'border-top-left-radius')).toBe('10px');
		const { width, height } = thumb.getBoundingClientRect();
		expect({ width, height }).toEqual({ width: THUMB_PX, height: THUMB_PX });
	});

	it('sets the title in the display serif at 18px', async () => {
		const { frame } = await openWithResults('tortilla');
		const title = partOf(optionTitled(frame, 'Tortilla de patatas'), 'title');
		expect(style(title, 'font-family')).toBe(computed('font-family', 'var(--font-display)'));
		expect(style(title, 'font-size')).toBe('18px');
	});

	it('sets the subtitle at 11.5px in --ink-3', async () => {
		const { frame } = await openWithResults('tortilla');
		const subtitle = partOf(optionTitled(frame, 'Tortilla de patatas'), 'subtitle');
		expect(style(subtitle, 'font-size')).toBe('11.5px');
		expect(style(subtitle, 'color')).toBe(computed('color', 'var(--ink-3)'));
	});

	it('cuts a long subtitle with an ellipsis on one line, inside the row', async () => {
		const { frame } = await openWithResults('castilla');
		const option = optionTitled(frame, 'Castilla y León');
		const subtitle = partOf(option, 'subtitle');
		expect(subtitle.textContent?.trim()).toBe(LONG_SUBTITLE_DISHES.join(', '));
		expect(style(subtitle, 'text-overflow')).toBe('ellipsis');
		expect(style(subtitle, 'white-space')).toBe('nowrap');
		expect(subtitle.scrollWidth, 'want the subtitle to overflow').toBeGreaterThan(
			subtitle.clientWidth
		);
		expect(option.getBoundingClientRect().right).toBeLessThanOrEqual(VIEWPORT.width);
	});

	it('ends each row with a decorative chevron', async () => {
		const { frame } = await openWithResults('tortilla');
		for (const option of options(frame)) {
			const icon = option.lastElementChild;
			expect(icon?.tagName.toLowerCase(), 'want an icon as the last child').toBe('svg');
			expect(icon?.getAttribute('aria-hidden')).toBe('true');
		}
	});

	it('reports a tapped row', async () => {
		const { frame, onSelect } = await openWithResults('galicia');
		await userEvent.click(optionTitled(frame, 'Galicia'));
		expect(onSelect).toHaveBeenCalledTimes(1);
		expect(onSelect.mock.calls[0][0]).toMatchObject({ group: 'region', regionKey: 'gal' });
	});
});

describe('SearchOverlay keyboard', () => {
	useViewport(VIEWPORT.width, VIEWPORT.height);

	it('starts with no active option', async () => {
		const { frame } = await openWithResults('tortilla');
		expect(activeOption(frame)).toBeNull();
		expect(selectedOptions(frame)).toEqual([]);
	});

	it('moves down through the results across groups and back up', async () => {
		const { frame } = await openWithResults('tortilla');
		await userEvent.keyboard('{ArrowDown}');
		expect(activeTitle(frame)).toBe('Tortilla de patatas');
		await userEvent.keyboard('{ArrowDown}');
		expect(activeTitle(frame)).toBe('Betanzos-style runny');
		await userEvent.keyboard('{ArrowUp}');
		expect(activeTitle(frame)).toBe('Tortilla de patatas');
	});

	it('keeps focus in the field while moving', async () => {
		const { input } = await openWithResults('tortilla');
		await userEvent.keyboard('{ArrowDown}{ArrowDown}');
		expect(document.activeElement).toBe(input);
	});

	it('marks only the active option selected', async () => {
		const { frame } = await openWithResults('tortilla');
		await userEvent.keyboard('{ArrowDown}{ArrowDown}');
		expect(selectedOptions(frame)).toEqual([activeOption(frame)]);
	});

	it('shows the active option differently from the others', async () => {
		const { frame } = await openWithResults('tortilla');
		await userEvent.keyboard('{ArrowDown}');
		const [active, other] = options(frame);
		expect(style(active, 'background-color')).not.toBe(style(other, 'background-color'));
	});

	it('selects the active option on Enter', async () => {
		const { onSelect } = await openWithResults('tortilla');
		await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}');
		expect(onSelect).toHaveBeenCalledTimes(1);
		const want = { group: 'variation', dishKey: 'tortilla', regionKey: 'gal' };
		expect(onSelect.mock.calls[0][0]).toMatchObject(want);
	});

	it('selects nothing on Enter without an active option', async () => {
		const { onSelect } = await openWithResults('tortilla');
		await userEvent.keyboard('{Enter}');
		expect(onSelect).not.toHaveBeenCalled();
	});

	it('drops the active option when the query changes', async () => {
		const { frame } = await openWithResults('tortilla');
		await userEvent.keyboard('{ArrowDown}');
		await typeQuery(frame, 'galicia');
		expect(activeOption(frame)).toBeNull();
	});
});

describe('SearchOverlay no results', () => {
	useViewport(VIEWPORT.width, VIEWPORT.height);

	it('says "Nothing for “query”" with the hint', async () => {
		const { frame, copy } = await openWithResults('zzz');
		expect(textIn(frame, nothingFor('en', 'zzz')), 'got no "Nothing for" line').toBeDefined();
		expect(textIn(frame, copy.hint), 'got no hint').toBeDefined();
	});

	it('sets the "Nothing for" line in the display serif at 22px', async () => {
		const { frame } = await openWithResults('zzz');
		const line = textIn(frame, nothingFor('en', 'zzz'))!;
		expect(style(line, 'font-family')).toBe(computed('font-family', 'var(--font-display)'));
		expect(style(line, 'font-size')).toBe('22px');
	});

	it('says it in the page language', async () => {
		const { frame } = await renderSearch({ lang: 'ru' });
		await focusedInput(frame);
		await typeQuery(frame, 'zzz');
		expect(textIn(frame, nothingFor('ru', 'zzz')), 'got no ru "nothing" line').toBeDefined();
		expect(textIn(frame, SEARCH_COPY.ru.hint), 'got no ru hint').toBeDefined();
	});

	it('collapses the combobox and shows no options or suggestions', async () => {
		const { frame, input, copy } = await openWithResults('zzz');
		expect(input.getAttribute('aria-expanded')).toBe('false');
		expect(options(frame)).toEqual([]);
		expect(textIn(frame, copy.try)).toBeUndefined();
	});
});
