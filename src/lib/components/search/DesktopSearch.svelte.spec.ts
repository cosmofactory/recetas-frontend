import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { getLocale, overwriteGetLocale } from '#lib/paraglide/runtime.js';
import { pushEscapeLayer } from '#lib/ui/escape-layers.ts';
import {
	activeDropdownTitle,
	buttonNamed,
	dropdown,
	dropdownOption,
	dropdownShown,
	dropdownTitles,
	fieldBox,
	fieldInput,
	renderDesktopSearch,
	shownDropdown,
	textInDropdown,
	typeInField
} from '../../../testutil/desktop-search';
import {
	DESKTOP_PLACEHOLDER,
	nothingFor,
	SEARCH_COPY,
	SEARCH_LOCALES
} from '../../../testutil/search-copy';
import { settle } from '../../../testutil/sheet';
import {
	animates,
	computed,
	emulateReducedMotion,
	resetEmulatedMedia,
	style,
	transitionDuration,
	transitionTimingFunction,
	useViewport
} from '../../../testutil/ui';

// FE-7 PR 4, DesktopSearch: the inline search in the desktop top bar (≥ 860px).
//
// Sources:
// - Desktop README -> Top bar (L51): "inline search field (height 44px,
//   width clamp(220px, 25vw, 360px)) ... Search results open in a dropdown
//   under the field (width min(440px, 100vw − 48px), max-height 520px,
//   radius 18px, shadow 0 18px 44px rgba(43,30,22,.2)); Escape or outside
//   click closes."
// - Desktop prototype (Asadorov Desktop.dc.html):
//   - L27–29: the field is a pill on #FBF7EC (--bg-surface), "border:1.5px
//     solid {searchBd}", padding 0 16px, gap 10px, a 14px magnifier, the
//     input "font:500 14px", placeholder dt.ph (strings.json desktop.ph);
//     searchBd (L837) is rgba(43,30,22,.18) (--border-field) closed and
//     rgba(43,30,22,.45) open.
//   - L30–32: the "×" shows while there is text; clearQuery (L836) empties
//     the query and leaves the dropdown open.
//   - L29/L834: onFocus opens the dropdown; L833: typing opens it.
//   - L35–46/L839: with an empty query the open dropdown shows the TRY
//     eyebrow and the suggestion chips (showTry: !qn); a chip fills the query.
//   - L835: Escape closes the dropdown and KEEPS the query (searchOpen:
//     false only); L825: an outside click (the catch layer) closes it and
//     keeps the query too. Selecting (go(), L736) clears it.
//   - L838: the panel is "position:absolute;top:54px;right:0" in the
//     field's wrapper, bg #FBF7EC, 1px rgba(43,30,22,.1) (--border-card),
//     overflow-y auto, and enters with "opacity .18s, transform .22s
//     cubic-bezier(.32,.72,.28,1)" from translateY(-6px) (the language
//     menu's motion, --dur-menu-fade / --dur-menu / --ease).
// - Stage FE-7 -> Small decisions: the APG list-autocomplete combobox (the
//   same SearchCombobox, SearchResults and SearchResultRow as the mobile
//   overlay); arrows stop at the ends; Enter picks the active option.
// - CLAUDE.md: every Escape-closable layer goes through pushEscapeLayer.
//
// Decisions pinned here (FE-7 PR 4):
// - src/lib/components/search/DesktopSearch.svelte, props { open, index,
//   onOpen, onClose, onSelect } (testutil/desktop-search.ts), controlled
//   like SearchOverlay. The dropdown carries data-testid="search-dropdown";
//   the pill keeps SearchField's data-testid="search-field".
// - Escape keeps focus in the input (APG combobox: Escape dismisses the
//   popup, focus stays on the combobox); the prototype's blur() would drop
//   keyboard users on <body>.
// - The escape layer is kind `search`: above `overlay`, below `menu`.
// - Focus leaving the search (Tab past its last control) closes the
//   dropdown, so it never stays open behind the keyboard user. Moving
//   between the input, the "×" and the chips doesn't.
// - Picking a result clears the query (prototype go()); the screen closes
//   the dropdown when it navigates.
// - The field's content height is 44px and its border 1.5px, content-box as
//   in the prototype (like the desktop LanguageButton beside it): 47px outside.

const DROPDOWN = { belowFieldTop: 54, width: 440, sideMargin: 48, maxHeight: '520px' };
const FIELD_CONTENT_PX = 44;
const FIELD_BORDER_PX = 1.5;
const OPEN_BORDER_COLOUR = 'rgba(43, 30, 22, 0.45)';
const DROPDOWN_SHADOW = 'rgba(43, 30, 22, 0.2) 0px 18px 44px 0px';
const DROPDOWN_RADIUS = '18px';
const FADE_DURATION = '0.18s';
const SLIDE_DURATION = '0.22s';
const DESKTOP_VIEWPORT = { width: 1280, height: 800 };
// Narrower than 440 + 48, so min() picks 100vw − 48px.
const NARROW_VIEWPORT = { width: 470, height: 800 };

const baseGetLocale = getLocale;
afterEach(() => overwriteGetLocale(baseGetLocale));

async function openWithQuery(query: string) {
	const rendered = await renderDesktopSearch();
	const input = await typeInField(rendered.root, query);
	return { ...rendered, input };
}

describe('DesktopSearch field', () => {
	useViewport(DESKTOP_VIEWPORT.width, DESKTOP_VIEWPORT.height);

	for (const lang of SEARCH_LOCALES) {
		it(`${lang}: is a combobox named "${SEARCH_COPY[lang].dialog}" with the desktop placeholder`, async () => {
			const { root } = await renderDesktopSearch({ lang });
			const input = fieldInput(root);
			expect(input.getAttribute('aria-label')).toBe(SEARCH_COPY[lang].dialog);
			expect(input.placeholder).toBe(DESKTOP_PLACEHOLDER[lang]);
			expect(input.disabled, 'got the hydrated field disabled').toBe(false);
		});
	}

	it('is a list-autocomplete combobox, collapsed while closed', async () => {
		const { root } = await renderDesktopSearch();
		const input = fieldInput(root);
		expect(input.getAttribute('aria-autocomplete')).toBe('list');
		expect(input.getAttribute('aria-expanded')).toBe('false');
	});

	it(`is a ${FIELD_CONTENT_PX}px pill with a ${FIELD_BORDER_PX}px --border-field border on --bg-surface`, async () => {
		const { root } = await renderDesktopSearch();
		const box = fieldBox(root);
		const height = box.getBoundingClientRect().height;
		expect(height, 'outer height').toBeCloseTo(FIELD_CONTENT_PX + 2 * FIELD_BORDER_PX, 1);
		expect(style(box, 'border-top-width')).toBe(`${FIELD_BORDER_PX}px`);
		expect(style(box, 'border-top-color')).toBe(computed('color', 'var(--border-field)'));
		expect(style(box, 'background-color')).toBe(computed('background-color', 'var(--bg-surface)'));
		expect(style(box, 'border-top-left-radius')).toBe(
			computed('border-top-left-radius', 'var(--radius-pill)')
		);
	});

	it('darkens its border while the dropdown is open', async () => {
		const { root } = await openWithQuery('tortilla');
		expect(style(fieldBox(root), 'border-top-color')).toBe(OPEN_BORDER_COLOUR);
	});

	it('sets the input at 14px/500 in the text font', async () => {
		const { root } = await renderDesktopSearch();
		const input = fieldInput(root);
		expect(style(input, 'font-size')).toBe('14px');
		expect(style(input, 'font-weight')).toBe('500');
		expect(style(input, 'font-family')).toBe(computed('font-family', 'var(--font-text)'));
	});

	it('shows a decorative magnifier before the input', async () => {
		const { root } = await renderDesktopSearch();
		const icon = fieldBox(root).querySelector('svg');
		expect(icon, 'got no magnifier icon').not.toBeNull();
		expect(icon!.closest('[aria-hidden="true"]'), 'want the icon aria-hidden').not.toBeNull();
		const before = icon!.compareDocumentPosition(fieldInput(root));
		expect(
			before & Node.DOCUMENT_POSITION_FOLLOWING,
			'want the icon before the input'
		).toBeTruthy();
	});

	it('shows the "Clear search" button only while there is text', async () => {
		const { root, copy } = await renderDesktopSearch();
		expect(buttonNamed(root, copy.clear), 'got a clear button on an empty field').toBeUndefined();
		await typeInField(root, 'to');
		expect(buttonNamed(root, copy.clear), 'want a clear button with text').toBeDefined();
	});

	it('clear empties the query, keeps the dropdown open and focus in the field', async () => {
		const { root, copy, input, onClose } = await openWithQuery('tortilla');
		await userEvent.click(buttonNamed(root, copy.clear)!);
		expect(input.value).toBe('');
		expect(document.activeElement).toBe(input);
		expect(dropdownShown(root), 'want the dropdown still open').toBe(true);
		expect(onClose).not.toHaveBeenCalled();
	});
});

describe('DesktopSearch opening', () => {
	useViewport(DESKTOP_VIEWPORT.width, DESKTOP_VIEWPORT.height);

	it('shows no dropdown until asked to open', async () => {
		const { root } = await renderDesktopSearch();
		expect(dropdownShown(root), 'got a dropdown while closed').toBe(false);
		expect(root.querySelector('[role="listbox"]'), 'got a listbox while closed').toBeNull();
	});

	it('asks to open on focus', async () => {
		const { root, onOpen } = await renderDesktopSearch();
		await userEvent.click(fieldInput(root));
		expect(onOpen).toHaveBeenCalled();
		expect(dropdownShown(root), 'want the dropdown open').toBe(true);
	});

	it('asks to open on typing, after it was closed with the field focused', async () => {
		const { root, onOpen } = await openWithQuery('tortilla');
		await userEvent.keyboard('{Escape}');
		onOpen.mockClear();
		await userEvent.keyboard('s');
		expect(onOpen).toHaveBeenCalled();
		expect(dropdownShown(root), 'want typing to reopen it').toBe(true);
	});

	it('shows the TRY eyebrow and the suggestion chips for an empty query', async () => {
		const { root, copy } = await renderDesktopSearch();
		await userEvent.click(fieldInput(root));
		settle();
		expect(textInDropdown(root, copy.try), 'got no TRY eyebrow').toBeDefined();
		for (const chip of copy.suggestions) {
			expect(buttonNamed(shownDropdown(root), chip), `got no "${chip}" chip`).toBeDefined();
		}
		expect(root.querySelector('[role="listbox"]'), 'got a listbox for an empty query').toBeNull();
		expect(fieldInput(root).getAttribute('aria-expanded')).toBe('false');
	});

	it('fills the query from a chip, shows its results and refocuses the field', async () => {
		const { root, onClose } = await renderDesktopSearch();
		await userEvent.click(fieldInput(root));
		await userEvent.click(buttonNamed(shownDropdown(root), 'Galicia')!);
		expect(fieldInput(root).value).toBe('Galicia');
		expect(document.activeElement).toBe(fieldInput(root));
		expect(dropdownTitles(root)).toContain('Galicia');
		expect(onClose, 'got the chip click closing the dropdown').not.toHaveBeenCalled();
	});
});

describe('DesktopSearch dropdown', () => {
	useViewport(DESKTOP_VIEWPORT.width, DESKTOP_VIEWPORT.height);

	it(`hangs ${DROPDOWN.belowFieldTop}px below the field's top, right-aligned with it`, async () => {
		const { root } = await openWithQuery('tortilla');
		const field = fieldBox(root).getBoundingClientRect();
		const panel = shownDropdown(root).getBoundingClientRect();
		expect(panel.top - field.top, 'dropdown top below the field top').toBeCloseTo(
			DROPDOWN.belowFieldTop,
			0
		);
		expect(panel.right, 'dropdown right edge').toBeCloseTo(field.right, 0);
	});

	it(`is ${DROPDOWN.width}px wide on a wide window`, async () => {
		const { root } = await openWithQuery('tortilla');
		expect(shownDropdown(root).getBoundingClientRect().width).toBeCloseTo(DROPDOWN.width, 0);
	});

	it('caps its height at 520px and scrolls inside itself', async () => {
		const { root } = await openWithQuery('tortilla');
		const panel = shownDropdown(root);
		expect(style(panel, 'max-height')).toBe(DROPDOWN.maxHeight);
		expect(style(panel, 'overflow-y')).toBe('auto');
	});

	it('is a --bg-surface card, radius 18px, 1px --border-card, the README shadow', async () => {
		const { root } = await openWithQuery('tortilla');
		const panel = shownDropdown(root);
		expect(style(panel, 'background-color')).toBe(
			computed('background-color', 'var(--bg-surface)')
		);
		expect(style(panel, 'border-top-left-radius')).toBe(DROPDOWN_RADIUS);
		expect(style(panel, 'border-top-width')).toBe('1px');
		expect(style(panel, 'border-top-color')).toBe(computed('color', 'var(--border-card)'));
		expect(style(panel, 'box-shadow')).toBe(DROPDOWN_SHADOW);
	});

	it('groups results under Dishes, Variations, Regions, in search order', async () => {
		const { root } = await openWithQuery('tortilla');
		const groups = [...shownDropdown(root).querySelectorAll('[role="listbox"] [role="group"]')];
		const names = groups.map((g) => {
			const id = g.getAttribute('aria-labelledby') ?? '';
			return document.getElementById(id)?.textContent?.trim();
		});
		expect(names).toEqual(['Dishes', 'Variations']);
		expect(dropdownTitles(root)).toEqual([
			'Tortilla de patatas',
			'Betanzos-style runny',
			'Sacromonte'
		]);
	});

	it('expands the combobox and points it at its listbox', async () => {
		const { root, input } = await openWithQuery('tortilla');
		const listbox = shownDropdown(root).querySelector('[role="listbox"]');
		expect(listbox, 'got no listbox').not.toBeNull();
		expect(input.getAttribute('aria-expanded')).toBe('true');
		expect(input.getAttribute('aria-controls')).toBe(listbox!.id);
	});

	it('ignores accents (the same search() as mobile)', async () => {
		const { root } = await openWithQuery('andalucia');
		expect(dropdownTitles(root)).toContain('Andalucía');
	});

	it('says "Nothing for “query”" with the hint when nothing matches', async () => {
		const { root, copy } = await openWithQuery('zzz');
		expect(
			textInDropdown(root, nothingFor('en', 'zzz')),
			'got no "Nothing for" line'
		).toBeDefined();
		expect(textInDropdown(root, copy.hint), 'got no hint').toBeDefined();
	});

	it('speaks the page language', async () => {
		const { root } = await renderDesktopSearch({ lang: 'ru' });
		await typeInField(root, 'zzz');
		expect(textInDropdown(root, nothingFor('ru', 'zzz'))).toBeDefined();
	});
});

describe('DesktopSearch dropdown width on a narrow window', () => {
	useViewport(NARROW_VIEWPORT.width, NARROW_VIEWPORT.height);

	it('is 100vw − 48px when that is under 440px', async () => {
		const { root } = await openWithQuery('tortilla');
		const want = NARROW_VIEWPORT.width - DROPDOWN.sideMargin;
		expect(shownDropdown(root).getBoundingClientRect().width).toBeCloseTo(want, 0);
	});
});

describe('DesktopSearch motion', () => {
	useViewport(DESKTOP_VIEWPORT.width, DESKTOP_VIEWPORT.height);
	afterEach(resetEmulatedMedia);

	it(`fades over ${FADE_DURATION} and slides over ${SLIDE_DURATION} with --ease`, async () => {
		const { root } = await openWithQuery('tortilla');
		const panel = shownDropdown(root);
		expect(transitionDuration(panel, 'opacity')).toBe(FADE_DURATION);
		expect(transitionDuration(panel, 'transform')).toBe(SLIDE_DURATION);
		const ease = computed('transition-timing-function', 'var(--ease)');
		expect(transitionTimingFunction(panel, 'transform')).toBe(ease);
	});

	it('only fades under prefers-reduced-motion', async () => {
		await emulateReducedMotion('reduce');
		const { root } = await openWithQuery('tortilla');
		const panel = shownDropdown(root);
		expect(animates(panel, 'transform'), 'got a transform transition').toBe(false);
		expect(transitionDuration(panel, 'opacity')).toBe(FADE_DURATION);
	});
});

describe('DesktopSearch keyboard', () => {
	useViewport(DESKTOP_VIEWPORT.width, DESKTOP_VIEWPORT.height);

	it('moves through the results with the arrows, focus staying in the field', async () => {
		const { root, input } = await openWithQuery('tortilla');
		expect(activeDropdownTitle(root)).toBeNull();
		await userEvent.keyboard('{ArrowDown}');
		expect(activeDropdownTitle(root)).toBe('Tortilla de patatas');
		await userEvent.keyboard('{ArrowDown}');
		expect(activeDropdownTitle(root)).toBe('Betanzos-style runny');
		await userEvent.keyboard('{ArrowUp}');
		expect(activeDropdownTitle(root)).toBe('Tortilla de patatas');
		expect(document.activeElement).toBe(input);
	});

	it('stops at the last result', async () => {
		const { root } = await openWithQuery('tortilla');
		await userEvent.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}');
		expect(activeDropdownTitle(root)).toBe('Sacromonte');
	});

	it('picks the active option on Enter and clears the query', async () => {
		const { onSelect, input } = await openWithQuery('tortilla');
		await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}');
		expect(onSelect).toHaveBeenCalledTimes(1);
		const want = { group: 'variation', dishKey: 'tortilla', regionKey: 'gal' };
		expect(onSelect.mock.calls[0][0]).toMatchObject(want);
		expect(input.value, 'want the query cleared after picking').toBe('');
	});

	it('picks nothing on Enter without an active option', async () => {
		const { onSelect } = await openWithQuery('tortilla');
		await userEvent.keyboard('{Enter}');
		expect(onSelect).not.toHaveBeenCalled();
	});
});

describe('DesktopSearch closing', () => {
	useViewport(DESKTOP_VIEWPORT.width, DESKTOP_VIEWPORT.height);

	it('Escape asks to close, keeps the query and focus in the field', async () => {
		const { root, input, onClose } = await openWithQuery('tortilla');
		await userEvent.keyboard('{Escape}');
		expect(onClose).toHaveBeenCalledTimes(1);
		expect(dropdownShown(root), 'got the dropdown still open').toBe(false);
		expect(input.value, 'want the query kept (prototype L835)').toBe('tortilla');
		expect(document.activeElement).toBe(input);
	});

	it('Escape reaches a menu layer above it first', async () => {
		const { onClose } = await openWithQuery('tortilla');
		const menuEscape = vi.fn();
		const pop = pushEscapeLayer('menu', menuEscape);
		try {
			await userEvent.keyboard('{Escape}');
		} finally {
			pop();
		}
		expect(menuEscape, 'want the menu layer to take Escape').toHaveBeenCalledTimes(1);
		expect(onClose, 'got the search closing under a menu').not.toHaveBeenCalled();
	});

	it('Escape closes only the search above an overlay layer', async () => {
		const overlayEscape = vi.fn();
		const pop = pushEscapeLayer('overlay', overlayEscape);
		try {
			const { onClose } = await openWithQuery('tortilla');
			await userEvent.keyboard('{Escape}');
			expect(onClose).toHaveBeenCalledTimes(1);
		} finally {
			pop();
		}
		expect(overlayEscape, 'got the overlay closing too').not.toHaveBeenCalled();
	});

	it('an outside click asks to close and keeps the query', async () => {
		const { root, outside, input, onClose } = await openWithQuery('tortilla');
		await userEvent.click(outside);
		expect(onClose).toHaveBeenCalled();
		expect(dropdownShown(root), 'got the dropdown still open').toBe(false);
		expect(input.value, 'want the query kept (prototype L825)').toBe('tortilla');
	});

	it('a click inside the dropdown, off the results, keeps it open', async () => {
		const { root, copy, onClose } = await openWithQuery('tortilla');
		await userEvent.click(textInDropdown(root, copy.groups[0])!);
		expect(onClose).not.toHaveBeenCalled();
		expect(dropdownShown(root)).toBe(true);
	});

	it('Tab past the search asks to close; the clear button on the way does not', async () => {
		const { root, outside, copy, onClose } = await openWithQuery('tortilla');
		await userEvent.tab();
		expect(document.activeElement).toBe(buttonNamed(root, copy.clear));
		expect(onClose, 'got the clear button closing it').not.toHaveBeenCalled();
		await userEvent.tab();
		expect(document.activeElement).toBe(outside);
		expect(onClose).toHaveBeenCalled();
		expect(dropdownShown(root)).toBe(false);
	});
});

describe('DesktopSearch selecting', () => {
	useViewport(DESKTOP_VIEWPORT.width, DESKTOP_VIEWPORT.height);

	it('reports a clicked result and clears the query', async () => {
		const { root, input, onSelect } = await openWithQuery('galicia');
		await userEvent.click(dropdownOption(root, 'Galicia'));
		expect(onSelect).toHaveBeenCalledTimes(1);
		expect(onSelect.mock.calls[0][0]).toMatchObject({ group: 'region', regionKey: 'gal' });
		expect(input.value).toBe('');
	});

	it('keeps focus in the field when a result is pressed', async () => {
		const { root, input } = await openWithQuery('galicia');
		const option = dropdownOption(root, 'Galicia');
		option.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
		expect(document.activeElement).toBe(input);
		expect(dropdown(root)).not.toBeNull();
	});
});
