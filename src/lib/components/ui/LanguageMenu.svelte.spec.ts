import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { getLocale, overwriteGetLocale } from '#lib/paraglide/runtime.js';
import { pushEscapeLayer } from '#lib/ui/escape-layers.ts';
import {
	CURRENT_MARK,
	LANGUAGE_ROWS,
	MENU_EYEBROW,
	MENU_LOCALES,
	switchHref,
	type MenuLocale
} from '../../../testutil/language-menu-copy';
import {
	menuIn,
	menuItems,
	renderMenu,
	ROW_NAMES,
	rowFor,
	shownText
} from '../../../testutil/language-menu';
import { appendButton, screenFrame, settle } from '../../../testutil/sheet';
import {
	animates,
	computed,
	emulateReducedMotion,
	resetEmulatedMedia,
	style,
	textContrast,
	textElement,
	transitionDuration,
	transitionTimingFunction,
	ungatedHoverRules,
	useViewport
} from '../../../testutil/ui';

// FE-7 PR 3, LanguageMenu: the header's language dropdown, mobile and desktop.
//
// Sources:
// - Mobile README -> Overlay — Language menu (L154–159): "width 200px, bg
//   surface, 1px --border-card, radius 14px, shadow 0 14px 34px
//   rgba(43,30,22,.18), padding 6px. Opens with opacity 0→1 (180ms) and
//   translateY −6px→0 (220ms --ease). A transparent full-screen layer behind
//   it closes it on outside tap." Eyebrow "(10px/700, .11em, ink-4, padding
//   8px 12px 6px)". Rows "padding 12px, radius 9px, 14px/500, hover
//   --bg-surface-muted. Right side: the code (11px/700, ink-4), or ✓ in
//   accent for the current language (that row also gets --bg-surface-muted)".
// - Desktop README -> Overlay — Language menu (L67–72): the same, "width 210px".
// - Prototype (Asadorov Explorations.dc.html L173–181, L1156–1157, L1194):
//   the current row shows ✓ INSTEAD of its code; the rows are English,
//   Español, Русский in that order.
// - Stage FE-7 -> Language menu: rows link to /set-lang (languageSwitchHref);
//   "It uses menu semantics with arrow-key navigation"; Escape closes.
// - CLAUDE.md: Escape goes through pushEscapeLayer; reduced motion swaps a
//   slide for a fade (motionFor); hover styles under @media (hover: hover);
//   accent-coloured text uses --accent-text (AA overrides).
//
// Decisions pinned here (FE-7 PR 3):
// - ARIA is the APG menu button pattern: role="menu" named by the localized
//   "Language" (its eyebrow), rows are <a role="menuitem"> real links. The
//   current row has aria-current="true" (aria-current="page" also accepted),
//   and every row carries lang="<code>" (WCAG 3.1.2: each name is in its
//   own language).
// - Inside the menu ArrowDown/ArrowUp move focus and WRAP at the ends (APG
//   menu examples); Home/End jump to the first/last row. Tab asks to close.
// - Escape is a layer above the region/dish sheets: with a sheet layer
//   also shown, Escape closes only the menu.
// - The transparent catch layer belongs to the menu component: an outside
//   tap lands on it (not on what is under it) and asks to close.

const VIEWPORT = { width: 390, height: 844 };
const FADE_DURATION = '0.18s';
const SLIDE_DURATION = '0.22s';
const ENTER_OFFSET_PX = -6;
const SHADOW = 'rgba(43, 30, 22, 0.18) 0px 14px 34px 0px';
const AA_TEXT = 4.5;

const baseGetLocale = getLocale;
afterEach(() => overwriteGetLocale(baseGetLocale));

// The translateY of a computed transform (0 for none).
function translateY(el: HTMLElement): number {
	const transform = style(el, 'transform');
	return transform === 'none' ? 0 : new DOMMatrixReadOnly(transform).m42;
}

const isShown = (el: HTMLElement) => el.checkVisibility({ visibilityProperty: true });

async function focusRow(frame: HTMLElement, index: number) {
	const item = menuItems(frame)[index];
	item.focus();
	expect(document.activeElement, `got row ${index} not focusable`).toBe(item);
}

const focusedRowName = (frame: HTMLElement) => {
	const index = menuItems(frame).indexOf(document.activeElement as HTMLElement);
	return index < 0
		? `(focus outside the rows: ${document.activeElement?.tagName})`
		: ROW_NAMES[index];
};

describe('LanguageMenu semantics', () => {
	useViewport(VIEWPORT.width, VIEWPORT.height);

	for (const lang of MENU_LOCALES) {
		it(`${lang}: a role="menu" with the given id, named "${MENU_EYEBROW[lang]}"`, async () => {
			const { frame } = await renderMenu({ lang });
			const menu = menuIn(frame);
			const labelledBy = menu.getAttribute('aria-labelledby');
			const name = labelledBy
				? document.getElementById(labelledBy)?.textContent?.trim()
				: menu.getAttribute('aria-label');
			expect(name?.toLowerCase(), `got name ${name}`).toBe(MENU_EYEBROW[lang].toLowerCase());
		});

		it(`${lang}: the eyebrow reads "${MENU_EYEBROW[lang].toUpperCase()}"`, async () => {
			const { frame } = await renderMenu({ lang });
			const eyebrow = textElement(menuIn(frame), MENU_EYEBROW[lang]);
			expect(shownText(eyebrow)).toBe(MENU_EYEBROW[lang].toUpperCase());
		});
	}

	it('has three menuitems: English, Español, Русский, in that order', async () => {
		const { frame } = await renderMenu();
		const names = menuItems(frame).map((item) => shownText(item).split(' ')[0]);
		expect(names).toEqual(ROW_NAMES);
	});

	it('each row is a link with lang="<code>"', async () => {
		const { frame } = await renderMenu();
		for (const [i, item] of menuItems(frame).entries()) {
			expect(item.tagName, `got row ${i} as <${item.tagName}>`).toBe('A');
			expect(item.getAttribute('lang')).toBe(LANGUAGE_ROWS[i].code);
		}
	});

	const pages = [
		{ path: '/es/regions/gal', rest: '/regions/gal' },
		{ path: '/en/?tab=popular&f=tapas&dish=tortilla', rest: '/?tab=popular&f=tapas&dish=tortilla' },
		{ path: '/ru/dishes/tortilla/gal', rest: '/dishes/tortilla/gal' }
	];
	for (const { path, rest } of pages) {
		it(`on ${path}, each row links to /set-lang for the same route in its locale`, async () => {
			const lang = path.slice(1, 3) as MenuLocale;
			const { frame } = await renderMenu({ lang, path });
			for (const { code } of LANGUAGE_ROWS) {
				expect(rowFor(frame, code).getAttribute('href')).toBe(switchHref(code, rest));
			}
		});
	}

	for (const lang of MENU_LOCALES) {
		it(`${lang}: only the ${lang} row is current, with ✓ instead of its code`, async () => {
			const { frame } = await renderMenu({ lang });
			for (const { code } of LANGUAGE_ROWS) {
				const row = rowFor(frame, code);
				const text = shownText(row);
				if (code === lang) {
					expect(row.getAttribute('aria-current'), `${code}: want aria-current`).toMatch(
						/^(true|page)$/
					);
					expect(text, `${code}: want ✓`).toContain(CURRENT_MARK);
					expect(text, `${code}: got its code beside ✓`).not.toContain(code.toUpperCase());
					continue;
				}
				expect(row.hasAttribute('aria-current'), `${code}: got aria-current`).toBe(false);
				expect(text, `${code}: want its code`).toContain(code.toUpperCase());
				expect(text, `${code}: got ✓`).not.toContain(CURRENT_MARK);
			}
		});
	}

	it('hides the ✓ from assistive tech (aria-current says it)', async () => {
		const { frame } = await renderMenu({ lang: 'es' });
		const mark = textElement(rowFor(frame, 'es'), CURRENT_MARK);
		expect(mark.closest('[aria-hidden="true"]'), 'want the ✓ aria-hidden').not.toBeNull();
	});
});

describe('LanguageMenu box', () => {
	useViewport(VIEWPORT.width, VIEWPORT.height);

	const widths = [
		{ size: 'mobile', width: 200 },
		{ size: 'desktop', width: 210 }
	] as const;
	for (const { size, width } of widths) {
		it(`size="${size}" is ${width}px wide`, async () => {
			const { frame } = await renderMenu({ size });
			expect(menuIn(frame).getBoundingClientRect().width).toBeCloseTo(width, 1);
		});
	}

	it('is a --bg-surface card: 1px --border-card, radius 14px, padding 6px, the menu shadow', async () => {
		const { frame } = await renderMenu();
		const menu = menuIn(frame);
		expect(style(menu, 'background-color')).toBe(computed('background-color', 'var(--bg-surface)'));
		expect(style(menu, 'border-top-width')).toBe('1px');
		expect(style(menu, 'border-top-style')).toBe('solid');
		expect(style(menu, 'border-top-color')).toBe(
			computed('border-top-color', 'var(--border-card)')
		);
		expect(style(menu, 'border-top-left-radius')).toBe('14px');
		expect(style(menu, 'padding-top')).toBe('6px');
		expect(style(menu, 'padding-left')).toBe('6px');
		expect(style(menu, 'box-shadow')).toBe(SHADOW);
	});

	it('eyebrow: 10px/700, .11em, padding 8px 12px 6px, AA on the surface', async () => {
		const { frame } = await renderMenu();
		const eyebrow = textElement(menuIn(frame), MENU_EYEBROW.en);
		expect(style(eyebrow, 'font-size')).toBe('10px');
		expect(style(eyebrow, 'font-weight')).toBe('700');
		expect(parseFloat(style(eyebrow, 'letter-spacing'))).toBeCloseTo(1.1, 2);
		expect(style(eyebrow, 'text-transform')).toBe('uppercase');
		const padding = ['top', 'right', 'bottom', 'left'].map((s) => style(eyebrow, `padding-${s}`));
		expect(padding).toEqual(['8px', '12px', '6px', '12px']);
		const surface = computed('background-color', 'var(--bg-surface)');
		expect(textContrast(eyebrow, surface)).toBeGreaterThanOrEqual(AA_TEXT);
	});

	it('rows: padding 12px, radius 9px, 14px/500, name left and mark right', async () => {
		const { frame } = await renderMenu();
		for (const row of menuItems(frame)) {
			expect(style(row, 'padding-top')).toBe('12px');
			expect(style(row, 'padding-left')).toBe('12px');
			expect(style(row, 'border-top-left-radius')).toBe('9px');
			const name = textElement(row, shownText(row).split(' ')[0]);
			expect(style(name, 'font-size')).toBe('14px');
			expect(style(name, 'font-weight')).toBe('500');
		}
		const row = rowFor(frame, 'es');
		const name = textElement(row, 'Español').getBoundingClientRect();
		const code = textElement(row, 'ES').getBoundingClientRect();
		expect(code.left, 'want the code right of the name').toBeGreaterThan(name.right);
		expect(row.getBoundingClientRect().right - code.right).toBeCloseTo(12, 0);
	});

	it('the current row is --bg-surface-muted, the others transparent', async () => {
		const { frame } = await renderMenu({ lang: 'ru' });
		const muted = computed('background-color', 'var(--bg-surface-muted)');
		expect(style(rowFor(frame, 'ru'), 'background-color')).toBe(muted);
		for (const code of ['en', 'es'] as const) {
			expect(style(rowFor(frame, code), 'background-color')).toBe('rgba(0, 0, 0, 0)');
		}
	});

	it('the code is 11px/700 and AA on the surface; the ✓ is --accent-text', async () => {
		const { frame } = await renderMenu({ lang: 'ru' });
		const code = textElement(rowFor(frame, 'en'), 'EN');
		expect(style(code, 'font-size')).toBe('11px');
		expect(style(code, 'font-weight')).toBe('700');
		const surface = computed('background-color', 'var(--bg-surface)');
		expect(textContrast(code, surface)).toBeGreaterThanOrEqual(AA_TEXT);
		const mark = textElement(rowFor(frame, 'ru'), CURRENT_MARK);
		expect(style(mark, 'color')).toBe(computed('color', 'var(--accent-text)'));
	});

	it('hover styles sit under @media (hover: hover)', async () => {
		const { frame } = await renderMenu();
		for (const row of menuItems(frame)) expect(ungatedHoverRules(row)).toEqual([]);
	});
});

describe('LanguageMenu motion', () => {
	useViewport(VIEWPORT.width, VIEWPORT.height);
	afterEach(resetEmulatedMedia);

	it(`fades over ${FADE_DURATION} and slides over ${SLIDE_DURATION} with --ease`, async () => {
		const { frame } = await renderMenu();
		const menu = menuIn(frame);
		expect(transitionDuration(menu, 'opacity')).toBe(FADE_DURATION);
		expect(transitionDuration(menu, 'transform')).toBe(SLIDE_DURATION);
		const ease = computed('transition-timing-function', 'var(--ease)');
		expect(transitionTimingFunction(menu, 'transform')).toBe(ease);
	});

	it(`rests transparent, ${ENTER_OFFSET_PX}px up and hidden when closed`, async () => {
		const { frame } = await renderMenu({ open: false });
		const menu = menuIn(frame);
		expect(style(menu, 'opacity')).toBe('0');
		expect(translateY(menu)).toBeCloseTo(ENTER_OFFSET_PX, 1);
		expect(isShown(menu), 'got a visible closed menu').toBe(false);
	});

	it('rests opaque and in place when open', async () => {
		const { frame, setOpen } = await renderMenu({ open: false });
		await setOpen(true);
		const menu = menuIn(frame);
		expect(style(menu, 'opacity')).toBe('1');
		expect(translateY(menu)).toBeCloseTo(0, 1);
		expect(isShown(menu), 'got the open menu hidden').toBe(true);
	});

	it('only fades under prefers-reduced-motion', async () => {
		await emulateReducedMotion('reduce');
		const { frame } = await renderMenu();
		const menu = menuIn(frame);
		expect(animates(menu, 'transform'), 'got a transform transition').toBe(false);
		expect(transitionDuration(menu, 'opacity')).toBe(FADE_DURATION);
	});
});

describe('LanguageMenu keyboard', () => {
	useViewport(VIEWPORT.width, VIEWPORT.height);

	it('rows are not focusable while closed', async () => {
		const { frame } = await renderMenu({ open: false });
		for (const item of menuItems(frame)) {
			item.focus();
			expect(document.activeElement, 'got a closed row focused').not.toBe(item);
		}
	});

	it('rows stay out of the Tab order (roving focus, tabindex -1)', async () => {
		const { frame } = await renderMenu();
		for (const item of menuItems(frame)) expect(item.getAttribute('tabindex')).toBe('-1');
	});

	const moves: { name: string; from: number; key: string; want: string }[] = [
		{ name: 'ArrowDown moves down', from: 0, key: '{ArrowDown}', want: 'Español' },
		{ name: 'ArrowDown wraps to the first', from: 2, key: '{ArrowDown}', want: 'English' },
		{ name: 'ArrowUp moves up', from: 2, key: '{ArrowUp}', want: 'Español' },
		{ name: 'ArrowUp wraps to the last', from: 0, key: '{ArrowUp}', want: 'Русский' },
		{ name: 'End jumps to the last', from: 0, key: '{End}', want: 'Русский' },
		{ name: 'Home jumps to the first', from: 2, key: '{Home}', want: 'English' }
	];
	for (const { name, from, key, want } of moves) {
		it(`${name} (from ${ROW_NAMES[from]})`, async () => {
			const { frame, onClose } = await renderMenu();
			await focusRow(frame, from);
			await userEvent.keyboard(key);
			expect(focusedRowName(frame)).toBe(want);
			expect(onClose).not.toHaveBeenCalled();
		});
	}

	// Focus can sit on the menu itself (tabindex -1), e.g. after a click on its
	// padding or eyebrow: ArrowUp then goes to the last row, ArrowDown to the first.
	const fromContainer = [
		{ key: '{ArrowUp}', want: 'Русский' },
		{ key: '{ArrowDown}', want: 'English' }
	];
	for (const { key, want } of fromContainer) {
		it(`${key} from the menu container focuses ${want}`, async () => {
			const { frame, onClose } = await renderMenu();
			const menu = menuIn(frame);
			menu.focus();
			expect(document.activeElement, 'got the menu not focusable').toBe(menu);
			await userEvent.keyboard(key);
			expect(focusedRowName(frame)).toBe(want);
			expect(onClose).not.toHaveBeenCalled();
		});
	}

	it('asks to close on Escape', async () => {
		const { frame, onClose } = await renderMenu();
		await focusRow(frame, 1);
		await userEvent.keyboard('{Escape}');
		expect(onClose, 'want one onClose call').toHaveBeenCalledTimes(1);
	});

	it('ignores Escape while closed', async () => {
		const { onClose } = await renderMenu({ open: false });
		await userEvent.keyboard('{Escape}');
		expect(onClose).not.toHaveBeenCalled();
	});

	it('asks to close on Tab', async () => {
		const { frame, onClose } = await renderMenu();
		await focusRow(frame, 0);
		await userEvent.tab();
		expect(onClose, 'want Tab to close the menu').toHaveBeenCalledTimes(1);
	});

	it('returns focus to the opener once closed', async () => {
		const { frame, opener, setOpen } = await renderMenu();
		await focusRow(frame, 1);
		await userEvent.keyboard('{Escape}');
		await setOpen(false);
		await expect.poll(() => document.activeElement, { timeout: 1000 }).toBe(opener);
	});

	it('closes only itself on Escape above a shown sheet layer', async () => {
		const sheetClose = vi.fn();
		const removeSheet = pushEscapeLayer('sheet', sheetClose);
		try {
			const { frame, onClose } = await renderMenu();
			await focusRow(frame, 0);
			await userEvent.keyboard('{Escape}');
			expect(onClose, 'want the menu to close').toHaveBeenCalledTimes(1);
			expect(sheetClose, 'got the sheet closing too').not.toHaveBeenCalled();
		} finally {
			removeSheet();
		}
	});
});

describe('LanguageMenu outside tap', () => {
	useViewport(VIEWPORT.width, VIEWPORT.height);

	// A control far from the menu, under where the catch layer must be.
	function outsideControl(frame: HTMLElement) {
		const control = appendButton(frame, 'Outside');
		control.setAttribute('style', 'position: absolute; left: 20px; bottom: 40px');
		const onClick = vi.fn();
		control.addEventListener('click', onClick);
		const rect = control.getBoundingClientRect();
		return { control, onClick, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
	}

	it('covers the page with a transparent layer that asks to close', async () => {
		const frame = screenFrame();
		const { control, onClick, x, y } = outsideControl(frame);
		const { onClose } = await renderMenu({ frame });
		const hit = document.elementFromPoint(x, y) as HTMLElement | null;
		expect(hit, 'want something under the point').not.toBeNull();
		expect(hit === control || control.contains(hit), 'got the tap reaching the page').toBe(false);
		expect(style(hit!, 'background-color')).toBe('rgba(0, 0, 0, 0)');
		hit!.click();
		expect(onClose, 'want an outside tap to close').toHaveBeenCalledTimes(1);
		expect(onClick, 'got the page control activated').not.toHaveBeenCalled();
	});

	it('leaves the page tappable while closed', async () => {
		const frame = screenFrame();
		const { control, x, y } = outsideControl(frame);
		await renderMenu({ frame, open: false });
		settle();
		const hit = document.elementFromPoint(x, y);
		expect(hit === control, `got ${hit?.outerHTML.slice(0, 80)} over the page`).toBe(true);
	});

	it('a tap on a row is not an outside tap', async () => {
		const { frame, onClose } = await renderMenu();
		const row = rowFor(frame, 'es');
		const rect = row.getBoundingClientRect();
		const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
		expect(hit === row || row.contains(hit), 'want the row on top of the catch layer').toBe(true);
		expect(onClose).not.toHaveBeenCalled();
	});
});
