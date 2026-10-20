import type { Snippet } from 'svelte';
import { createRawSnippet } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page, userEvent } from 'vitest/browser';
import {
	computed,
	hitArea,
	loadUi,
	paintedBox,
	stage,
	style,
	ungatedHoverRules,
	useViewport
} from '../../../testutil/ui';

// FE-3 DesktopTopBar (Delivery 4). Desktop README -> Layout & screens, "Top
// bar (height 76px, hairline bottom border, z above content): logo
// (Instrument Serif 31px, click → home) · Regional | Popular switch (width
// `clamp(240px, 22vw, 320px)`, same style as mobile) · spacer · inline search
// field (height 44px, width `clamp(220px, 25vw, 360px)`) · language button
// (height 44px)". Content max-width 1440px, centred; side padding
// `clamp(24px, 2.8vw, 40px)`.
//
// The prototype (Asadorov Desktop.dc.html l.18–68) gives what the README
// leaves out, and it wins where they differ (owner decision 2026-10-20):
// - bar: `height:76px; border-bottom:1px solid rgba(43,30,22,.1)` (=
//   --border-card); `background:#F6EFE3` (= --bg-page); `position:relative;
//   z-index:30`. The prototype's boxes are content-box (only the row says
//   border-box), and the prototype wins (FE-3 review): the bar is 76px plus
//   its 1px hairline = 77px outside, the switch track (l.21 `padding:4px;
//   width:clamp(240px,22vw,320px)`) is the clamp plus 8px, and the language
//   button (l.68 `height:44px; border:1.5px solid`) is 44px plus its
//   borders.
// - inner row: `max-width:1440px; margin:0 auto; padding:0 clamp(24px,2.8vw,
//   40px); box-sizing:border-box; display:flex; align-items:center;
//   gap:clamp(20px,2.5vw,36px)`, so at 1600px the row is 1440px wide
//   including its padding (logo at 80 + 40 = 120px).
// - logo: `font-family:'Instrument Serif',…; font-size:31px; flex:none`, the
//   literal "Asadorov" (never translated), a link home (`homeHref`).
// - switch: `width:clamp(240px,22vw,320px); flex:none`; a SegmentedSwitch
//   with the caller's options/value/onChange.
// - spacer `flex:1`, then the search field (a `search` snippet, FE-7), then
//   the language button: `height:44px; padding:0 14px 0 16px;
//   border-radius:999px; border:1.5px solid rgba(43,30,22,.2); gap:7px;
//   font-size:12.5px; font-weight:700; letter-spacing:.08em`, hover
//   `background:rgba(43,30,22,.06)` (= --bg-hover-subtle); it shows the
//   current language code upper-cased (`langCode: L.toUpperCase()`) and a
//   "▾" at `opacity:.55`. FE-7's language menu is a list of links, so the
//   button is a disclosure (aria-expanded + aria-controls, no
//   aria-haspopup), and its accessible name starts with the visible code
//   (WCAG 2.5.3), the localized label after it ("EN Language"). It sits in a `position:relative` wrapper that also
//   holds the menu, so the menu anchors under it ("Language menu is the same
//   as mobile, anchored under its button"): a `languageMenu` snippet (FE-7).
// Rendered only from 860px ("Below 860px a separate mobile layout applies").

type Option = { value: string; label: string; panelId?: string };
type Tabs = { options: Option[]; value: string; label: string; onChange?: (value: string) => void };
type Language = {
	label: string;
	code: string;
	expanded: boolean;
	controls?: string;
	onclick: (event: MouseEvent) => void;
};
type DesktopTopBarProps = {
	homeHref: string;
	tabs: Tabs;
	language: Language;
	search?: Snippet;
	languageMenu?: Snippet;
};

const LOGO = 'Asadorov';
const HOME_HREF = '/en/';
const TABS_LABEL = 'Browse';
const OPTIONS: Option[] = [
	{ value: 'regional', label: 'Regional' },
	{ value: 'popular', label: 'Popular' }
];
const LANGUAGE_LABEL = 'Language';
const BAR_HEIGHT_PX = 76;
const HAIRLINE_PX = 1;
// The switch track's padding (4px each side), outside its clamp() width.
const TRACK_PADDING_PX = 8;
const CONTROL_HEIGHT_PX = 44;
const LOGO_FONT_PX = '31px';
const CONTENT_MAX_PX = 1440;
const HIT_MIN_PX = 44;
const LANGUAGE_BORDER = 'rgba(43, 30, 22, 0.2)';
const CARET_OPACITY = '0.55';
const SEARCH_TEST_ID = 'search-slot';
const MENU_TEST_ID = 'language-menu';
const SEARCH_WIDTH_PX = 220;
const FULL_WIDTH = 'padding: 0';

// The prototype's clamp()s, in px for a viewport `vw` px wide.
// Rounded to 2 decimals, the precision the assertions compare at.
const clamp = (min: number, value: number, max: number) =>
	Number(Math.min(Math.max(value, min), max).toFixed(2));
const sidePadding = (vw: number) => clamp(24, 0.028 * vw, 40);
const itemGap = (vw: number) => clamp(20, 0.025 * vw, 36);
const switchWidth = (vw: number) => clamp(240, 0.22 * vw, 320) + TRACK_PADDING_PX;

function snippet(html: string): Snippet {
	return createRawSnippet(() => ({ render: () => html }));
}

const SEARCH = snippet(
	`<div data-testid="${SEARCH_TEST_ID}" style="width: ${SEARCH_WIDTH_PX}px; height: 44px"></div>`
);
// Anchored the way FE-7's menu will be: under its button, right-aligned.
const MENU = snippet(
	`<div data-testid="${MENU_TEST_ID}" style="position: absolute; top: 100%; right: 0; width: 40px; height: 40px"></div>`
);

function language(overrides: Partial<Language> = {}): Language {
	return { label: LANGUAGE_LABEL, code: 'en', expanded: false, onclick: () => {}, ...overrides };
}

function props(overrides: Partial<DesktopTopBarProps> = {}): DesktopTopBarProps {
	return {
		homeHref: HOME_HREF,
		tabs: { options: OPTIONS, value: 'regional', label: TABS_LABEL },
		language: language(),
		...overrides
	};
}

async function renderBar(overrides: Partial<DesktopTopBarProps> = {}, target = stage(FULL_WIDTH)) {
	const DesktopTopBar = await loadUi<DesktopTopBarProps>('DesktopTopBar');
	await render(DesktopTopBar, { target, props: props(overrides) });
	return target;
}

async function shownBar(overrides: Partial<DesktopTopBarProps> = {}) {
	const target = await renderBar(overrides);
	const bar = page.getByRole('banner');
	await expect.element(bar).toBeInTheDocument();
	return { target, bar: bar.element() as HTMLElement };
}

function logo(): HTMLElement {
	return page.getByRole('link', { name: LOGO, exact: true }).element() as HTMLElement;
}

function tablist(): HTMLElement {
	return page.getByRole('tablist', { name: TABS_LABEL, exact: true }).element() as HTMLElement;
}

function languageButton(): HTMLElement {
	return page.getByRole('button', { name: LANGUAGE_LABEL }).element() as HTMLElement;
}

// The language button's outer height: 44px plus its two 1.5px borders, as
// the browser snaps them to device pixels.
function languageButtonHeight(): number {
	const border = parseFloat(computed('border-top-width', '1.5px', 'border-style: solid'));
	return CONTROL_HEIGHT_PX + 2 * border;
}

function byTestId(id: string): HTMLElement {
	return page.getByTestId(id).element() as HTMLElement;
}

function centreY(el: Element): number {
	const rect = el.getBoundingClientRect();
	return rect.top + rect.height / 2;
}

// Where the row's content box starts and ends inside a bar `barWidth` wide.
function rowEdges(bar: HTMLElement, vw: number) {
	const rect = bar.getBoundingClientRect();
	const centring = Math.max(0, (rect.width - CONTENT_MAX_PX) / 2);
	return {
		left: rect.left + centring + sidePadding(vw),
		right: rect.right - centring - sidePadding(vw)
	};
}

describe('DesktopTopBar contents', () => {
	useViewport(1280, 800);

	it('is the page banner (a <header>)', async () => {
		const { bar } = await shownBar();
		expect(bar.tagName).toBe('HEADER');
	});

	it(`links the untranslated logo "${LOGO}" to homeHref`, async () => {
		await shownBar({ homeHref: '/ru/' });
		expect(logo().tagName).toBe('A');
		expect(logo().getAttribute('href')).toBe('/ru/');
		expect(logo().textContent?.trim()).toBe(LOGO);
	});

	it('renders the SegmentedSwitch with the given options, value and label', async () => {
		await shownBar({ tabs: { options: OPTIONS, value: 'popular', label: TABS_LABEL } });
		const tabs = [...tablist().querySelectorAll('[role="tab"]')];
		expect(tabs.map((tab) => tab.textContent?.trim())).toEqual(['Regional', 'Popular']);
		expect(tabs.map((tab) => tab.getAttribute('aria-selected'))).toEqual(['false', 'true']);
	});

	// Prototype l.22–23: the top bar's segments are `font-size:13.5px;
	// font-weight:600` (mobile: 13px); the bar uses SegmentedSwitch
	// size="desktop".
	it('sets the switch segments in 13.5px/600 (desktop prototype)', async () => {
		await shownBar();
		for (const tab of tablist().querySelectorAll('[role="tab"]')) {
			expect([style(tab, 'font-size'), style(tab, 'font-weight')]).toEqual(['13.5px', '600']);
		}
	});

	it("passes the switch's onChange through", async () => {
		const onChange = vi.fn();
		await shownBar({ tabs: { options: OPTIONS, value: 'regional', label: TABS_LABEL, onChange } });
		await page.getByRole('tab', { name: 'Popular' }).click();
		expect(onChange, 'want onChange("popular")').toHaveBeenCalledWith('popular');
	});

	it('orders logo, switch, search and language button left to right', async () => {
		await shownBar({ search: SEARCH });
		const lefts = [logo(), tablist(), byTestId(SEARCH_TEST_ID), languageButton()].map(
			(el) => el.getBoundingClientRect().left
		);
		expect(lefts, `got lefts ${lefts}`).toEqual([...lefts].sort((a, b) => a - b));
	});

	// Besides the logo, switch and language button (and the elements wrapping
	// them) only the empty flexible spacer may be left: no empty search box.
	it('renders nothing for the search field when no search snippet is given', async () => {
		const { bar } = await shownBar();
		const controls = [logo(), tablist(), languageButton()];
		const related = (el: Element) => controls.some((c) => c.contains(el) || el.contains(c));
		const others = [...bar.querySelectorAll('*')].filter((el) => !related(el));
		expect(
			others.length,
			`got ${others.map((el) => el.outerHTML)} besides the controls, want at most the spacer`
		).toBeLessThanOrEqual(1);
		for (const el of others) {
			expect(el.children.length, `got a spacer with children: ${el.outerHTML}`).toBe(0);
			expect(el.textContent?.trim(), `got a spacer with text: ${el.outerHTML}`).toBe('');
			expect(style(el, 'border-top-width'), 'got a bordered box (an empty field?)').toBe('0px');
		}
	});
});

describe('DesktopTopBar language button', () => {
	useViewport(1280, 800);

	it('is a button named by language.label, showing the code upper-cased', async () => {
		await shownBar({ language: language({ code: 'ru' }) });
		const button = languageButton();
		expect(button.tagName).toBe('BUTTON');
		expect(button.getAttribute('type')).toBe('button');
		expect(button.innerText).toContain('RU');
	});

	// WCAG 2.5.3 (label in name): the name starts with the visible code, the
	// localized label after it ("EN Language").
	it('names the button with the visible upper-case code first, then language.label', async () => {
		await shownBar();
		const button = page.getByRole('button', { name: LANGUAGE_LABEL });
		await expect.element(button).toHaveAccessibleName(new RegExp(`^EN\\b.*${LANGUAGE_LABEL}`));
	});

	it('shows a caret after the code, hidden from assistive tech, at opacity .55', async () => {
		await shownBar();
		const caret = languageButton().querySelector('[aria-hidden="true"]');
		expect(caret, 'got no aria-hidden caret in the button').not.toBeNull();
		expect(style(caret!, 'opacity')).toBe(CARET_OPACITY);
		const code = languageButton().getBoundingClientRect();
		expect(caret!.getBoundingClientRect().right, 'want the caret at the right').toBeGreaterThan(
			code.left + code.width / 2
		);
	});

	it('calls language.onclick when clicked', async () => {
		const onclick = vi.fn();
		await shownBar({ language: language({ onclick }) });
		await page.getByRole('button', { name: LANGUAGE_LABEL }).click();
		expect(onclick, 'want one onclick call').toHaveBeenCalledTimes(1);
	});

	const states = [false, true];
	for (const expanded of states) {
		it(`is a disclosure for FE-7's menu: aria-expanded="${expanded}", aria-controls, no aria-haspopup`, async () => {
			await shownBar({ language: language({ expanded, controls: 'lang-menu' }) });
			const button = languageButton();
			expect(button.getAttribute('aria-expanded')).toBe(String(expanded));
			expect(button.getAttribute('aria-controls')).toBe('lang-menu');
			expect(button.getAttribute('aria-haspopup'), 'got aria-haspopup on a disclosure').toBeNull();
		});
	}

	it('anchors the languageMenu snippet under the button, right-aligned', async () => {
		await shownBar({ languageMenu: MENU });
		const button = languageButton().getBoundingClientRect();
		const menu = byTestId(MENU_TEST_ID).getBoundingClientRect();
		expect(menu.right, `got menu right ${menu.right}, want ${button.right}`).toBeCloseTo(
			button.right,
			0
		);
		expect(menu.top, `got menu top ${menu.top}, want ${button.bottom}`).toBeCloseTo(
			button.bottom,
			0
		);
	});

	it(`is ${CONTROL_HEIGHT_PX}px tall plus its border, padding 0 14px 0 16px, a pill with a 1.5px rgba(43,30,22,.2) border`, async () => {
		await shownBar();
		const visual = paintedBox(languageButton());
		const { height } = visual.getBoundingClientRect();
		expect(height, `got outer height ${height}`).toBe(languageButtonHeight());
		const padding = ['top', 'right', 'bottom', 'left'].map((side) =>
			style(visual, `padding-${side}`)
		);
		expect(padding).toEqual(['0px', '14px', '0px', '16px']);
		expect(parseFloat(style(visual, 'border-top-left-radius'))).toBeGreaterThanOrEqual(height / 2);
		expect(style(visual, 'border-top-width')).toBe(
			computed('border-top-width', '1.5px', 'border-style: solid')
		);
		expect(style(visual, 'border-top-color')).toBe(LANGUAGE_BORDER);
		expect(style(visual, 'background-color'), 'want no resting background').toBe(
			'rgba(0, 0, 0, 0)'
		);
	});

	it('sets the code in 12.5px/700 ink with .08em letter-spacing', async () => {
		await shownBar();
		const button = languageButton();
		expect(style(button, 'font-size')).toBe('12.5px');
		expect(style(button, 'font-weight')).toBe('700');
		expect(style(button, 'letter-spacing')).toBe('1px');
		expect(style(button, 'color')).toBe(computed('color', 'var(--ink)'));
		expect(style(button, 'font-family')).toBe(computed('font-family', 'var(--font-text)'));
	});

	it('turns --bg-hover-subtle on hover, styled only under (hover: hover)', async () => {
		await shownBar();
		const button = languageButton();
		const visual = paintedBox(button);
		const rules = [button, visual].flatMap(ungatedHoverRules);
		expect(rules, `got ungated :hover rules ${JSON.stringify(rules)}`).toEqual([]);
		await userEvent.hover(button);
		await expect
			.poll(() => style(visual, 'background-color'))
			.toBe(computed('background-color', 'var(--bg-hover-subtle)'));
	});
});

describe('DesktopTopBar bar', () => {
	useViewport(1280, 800);

	it(`is ${BAR_HEIGHT_PX}px tall plus a 1px --border-card bottom hairline, on --bg-page`, async () => {
		const { bar } = await shownBar();
		expect(bar.getBoundingClientRect().height).toBe(BAR_HEIGHT_PX + HAIRLINE_PX);
		expect(style(bar, 'border-bottom-width')).toBe('1px');
		expect(style(bar, 'border-bottom-style')).toBe('solid');
		expect(style(bar, 'border-bottom-color')).toBe(
			computed('border-bottom-color', 'var(--border-card)')
		);
		expect(style(bar, 'border-top-width')).toBe('0px');
		expect(style(bar, 'background-color')).toBe(computed('background-color', 'var(--bg-page)'));
	});

	it('spans the full width of its container', async () => {
		const { target, bar } = await shownBar();
		expect(bar.getBoundingClientRect().width).toBe(target.clientWidth);
	});

	it('centres logo, switch and language button vertically', async () => {
		const { bar } = await shownBar({ search: SEARCH });
		const rect = bar.getBoundingClientRect();
		const rowCentre = rect.top + BAR_HEIGHT_PX / 2;
		for (const el of [logo(), tablist(), byTestId(SEARCH_TEST_ID), languageButton()]) {
			expect(Math.abs(centreY(el) - rowCentre), `got <${el.tagName}> off-centre`).toBeLessThan(1);
		}
	});

	it('stacks above the page content that follows it (z above content)', async () => {
		const target = stage(FULL_WIDTH);
		await renderBar({ languageMenu: MENU }, target);
		const content = document.createElement('div');
		// Like StickyPanel: positioned, no z-index, right under the bar.
		content.setAttribute('style', 'position: sticky; top: 0; height: 400px');
		target.append(content);
		const menu = byTestId(MENU_TEST_ID);
		const rect = menu.getBoundingClientRect();
		const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
		expect(hit === menu || menu.contains(hit), `got <${hit?.tagName}> over the menu`).toBe(true);
	});

	it(`gives the logo and language button a hit area of at least ${HIT_MIN_PX}px`, async () => {
		await shownBar();
		for (const control of [logo(), languageButton()]) {
			const area = hitArea(control);
			expect(area.height, `got <${control.tagName}> hit height ${area.height}`).toBeGreaterThan(
				HIT_MIN_PX - 1
			);
			expect(area.width, `got <${control.tagName}> hit width ${area.width}`).toBeGreaterThan(
				HIT_MIN_PX - 1
			);
		}
	});
});

describe('DesktopTopBar logo', () => {
	useViewport(1280, 800);

	it(`is set in --font-display ${LOGO_FONT_PX}/400 ink, not underlined`, async () => {
		await shownBar();
		const el = logo();
		expect(style(el, 'font-size')).toBe(LOGO_FONT_PX);
		expect(style(el, 'font-weight')).toBe('400');
		expect(style(el, 'font-family')).toBe(computed('font-family', 'var(--font-display)'));
		expect(style(el, 'color')).toBe(computed('color', 'var(--ink)'));
		expect(style(el, 'text-decoration-line')).toBe('none');
	});
});

// Stage acceptance (1280×800 and 1440×900) is a QA screenshot comparison;
// these pin the geometry it depends on, at each width the clamps change at.
const WIDTHS = [860, 1280, 1440, 1600];

for (const vw of WIDTHS) {
	describe(`DesktopTopBar geometry at ${vw}px wide`, () => {
		useViewport(vw, 800);

		it(`makes the switch clamp(240px, 22vw, 320px) + 8px padding = ${switchWidth(vw)}px wide`, async () => {
			await shownBar({ search: SEARCH });
			const { width } = tablist().getBoundingClientRect();
			expect(width, `got switch width ${width}`).toBeCloseTo(switchWidth(vw), 1);
		});

		it(`starts the logo at the row's left edge (centred 1440px row, side padding ${sidePadding(vw)}px)`, async () => {
			const { bar } = await shownBar();
			const { left } = logo().getBoundingClientRect();
			expect(left, `got logo left ${left}`).toBeCloseTo(rowEdges(bar, vw).left, 1);
		});

		it("ends the language button at the row's right edge", async () => {
			const { bar } = await shownBar({ search: SEARCH });
			const { right } = languageButton().getBoundingClientRect();
			expect(right, `got button right ${right}`).toBeCloseTo(rowEdges(bar, vw).right, 1);
		});

		it(`keeps the switch ${itemGap(vw)}px after the logo and the search ${itemGap(vw)}px before the button`, async () => {
			await shownBar({ search: SEARCH });
			const logoToSwitch =
				tablist().getBoundingClientRect().left - logo().getBoundingClientRect().right;
			const searchToButton =
				languageButton().getBoundingClientRect().left -
				byTestId(SEARCH_TEST_ID).getBoundingClientRect().right;
			expect(logoToSwitch, `got logo→switch ${logoToSwitch}`).toBeCloseTo(itemGap(vw), 1);
			expect(searchToButton, `got search→button ${searchToButton}`).toBeCloseTo(itemGap(vw), 1);
		});

		it(`is ${BAR_HEIGHT_PX}px + hairline tall with a ${CONTROL_HEIGHT_PX}px (+ border) language button`, async () => {
			const { bar } = await shownBar();
			expect(bar.getBoundingClientRect().height).toBe(BAR_HEIGHT_PX + HAIRLINE_PX);
			const button = paintedBox(languageButton()).getBoundingClientRect().height;
			expect(button, `got button height ${button}`).toBe(languageButtonHeight());
		});
	});
}

// FE-3 acceptance: "At 860px the desktop layout applies, and at 859px the
// mobile one does." Below 860px the mobile header (FE-4) renders instead.
describe('DesktopTopBar below the desktop breakpoint', () => {
	useViewport(859, 800);

	it('renders nothing visible at 859px', async () => {
		const target = await renderBar({ search: SEARCH, languageMenu: MENU });
		const visible = [...target.querySelectorAll('*')].filter((el) => el.checkVisibility());
		expect(
			visible.map((el) => el.tagName),
			'got top bar elements visible at 859px'
		).toEqual([]);
	});
});

describe('DesktopTopBar at the desktop breakpoint', () => {
	useViewport(860, 800);

	it('is visible at 860px', async () => {
		const { bar } = await shownBar();
		expect(bar.checkVisibility(), 'want the bar visible at 860px').toBe(true);
	});
});
