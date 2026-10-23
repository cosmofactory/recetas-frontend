import { expect, test, type Page } from '@playwright/test';
import { focusDesktopSearch, typeInDesktopSearch, searchDropdown } from './desktop-search-e2e';
import { LOCALES, type Locale } from './e2e';
import { isDesktopPage } from './home-e2e';
import { openMenu } from './language-menu-e2e';
import { filterSidebar, openFiltersSheet } from './popular-e2e';
import { expectSheetExpanded, expectSheetPeek, regionPanel, regionSheet } from './region-e2e';
import { nothingFor } from './search-copy';
import {
	DISHES,
	openSearch,
	resultGroup,
	resultOption,
	searchDialog,
	searchFor
} from './search-e2e';

// FE-8 PR 5a, the accessibility sweep: every route type and every sheet and
// overlay state, per layout, as one table the axe and hit-area specs share.
// Content is the vendored mock bundle (DATA_SOURCE=mock).

export { LOCALES, type Locale };
export type Layout = 'mobile' | 'desktop';

export const MOBILE: Layout[] = ['mobile'];
export const DESKTOP: Layout[] = ['desktop'];
export const BOTH: Layout[] = ['mobile', 'desktop'];

export type UiState = {
	name: string;
	// The path under /:lang, with its query.
	path: string;
	layouts: Layout[];
	// The HTTP status the page answers with (error pages).
	status?: number;
	// Brings the page from its load into the state, then waits for it.
	enter?: (page: Page, lang: Locale) => Promise<void>;
	// In the small subset that runs on WebKit and Firefox (stack.md F4).
	crossBrowser?: boolean;
};

export const layoutOf = (page: Page): Layout => (isDesktopPage(page) ? 'desktop' : 'mobile');

export function skipUnlessLayout(page: Page, layouts: Layout[]) {
	const layout = layoutOf(page);
	test.skip(!layouts.includes(layout), `this state exists on ${layouts.join(' and ')} only`);
}

// Catalog names from the mock bundle, per locale.
const GALICIA: Record<Locale, string> = { en: 'Galicia', es: 'Galicia', ru: 'Галисия' };
const TORTILLA: Record<Locale, string> = {
	en: 'Tortilla de patatas',
	es: 'Tortilla de patatas',
	ru: 'Тортилья'
};

// A query every locale finds (the Spanish name is searched too) and one nothing matches.
export const FINDS_QUERY = 'tortilla';
export const NO_MATCH_QUERY = 'zzzz';

async function regionShown(page: Page, lang: Locale) {
	if (isDesktopPage(page)) return expect(regionPanel(page, GALICIA[lang])).toBeVisible();
	await expectSheetPeek(page, GALICIA[lang]);
}

async function regionExpanded(page: Page, lang: Locale) {
	await expectSheetPeek(page, GALICIA[lang]);
	await regionSheet(page).locator('button[aria-expanded]').click();
	await expectSheetExpanded(page, GALICIA[lang]);
}

async function overlayWithResults(page: Page, lang: Locale) {
	await searchFor(page, lang, FINDS_QUERY);
	await expect(resultOption(resultGroup(page, lang, DISHES), TORTILLA[lang])).toBeVisible();
}

async function overlayWithNoMatch(page: Page, lang: Locale) {
	await searchFor(page, lang, NO_MATCH_QUERY);
	const nothing = searchDialog(page, lang).getByText(nothingFor(lang, NO_MATCH_QUERY));
	await expect(nothing).toBeVisible();
}

async function dropdownWithResults(page: Page, lang: Locale) {
	await typeInDesktopSearch(page, lang, FINDS_QUERY);
	await expect(searchDropdown(page).getByRole('option').first()).toBeVisible();
}

// The keyboard's active option (ArrowDown) takes the row highlight.
async function withActiveOption(
	page: Page,
	results: (page: Page, lang: Locale) => Promise<void>,
	lang: Locale
) {
	await results(page, lang);
	await page.keyboard.press('ArrowDown');
	await expect(page.getByRole('combobox').filter({ visible: true })).toHaveAttribute(
		'aria-activedescendant',
		/.+/
	);
}

async function dropdownWithNoMatch(page: Page, lang: Locale) {
	await typeInDesktopSearch(page, lang, NO_MATCH_QUERY);
	await expect(searchDropdown(page).getByText(nothingFor(lang, NO_MATCH_QUERY))).toBeVisible();
}

async function popularShown(page: Page) {
	if (isDesktopPage(page)) await expect(filterSidebar(page)).toBeVisible();
}

export const NOT_FOUND = 404;

export const UI_STATES: UiState[] = [
	{ name: 'home Regional', path: '/', layouts: BOTH, crossBrowser: true },
	{
		name: 'region page (sheet in peek / panel)',
		path: '/regions/gal',
		layouts: BOTH,
		enter: regionShown,
		crossBrowser: true
	},
	{ name: 'region sheet expanded', path: '/regions/gal', layouts: MOBILE, enter: regionExpanded },
	{
		name: 'Popular with filters active',
		path: '/?tab=popular&f=vegetarian&f=quick',
		layouts: BOTH,
		enter: popularShown
	},
	{
		name: 'dish sheet in peek',
		path: '/?tab=popular&dish=tortilla',
		layouts: MOBILE,
		enter: (page, lang) => expectSheetPeek(page, TORTILLA[lang])
	},
	{
		name: 'Filters sheet open',
		path: '/?tab=popular&f=vegetarian',
		layouts: MOBILE,
		enter: openFiltersSheet,
		crossBrowser: true
	},
	{ name: 'search overlay, empty', path: '/', layouts: MOBILE, enter: openSearch },
	{
		name: 'search overlay with results',
		path: '/',
		layouts: MOBILE,
		enter: overlayWithResults,
		crossBrowser: true
	},
	{
		name: 'search overlay, an option active',
		path: '/',
		layouts: MOBILE,
		enter: (page, lang) => withActiveOption(page, overlayWithResults, lang)
	},
	{ name: 'search overlay, no match', path: '/', layouts: MOBILE, enter: overlayWithNoMatch },
	{ name: 'search dropdown, suggestions', path: '/', layouts: DESKTOP, enter: focusDesktopSearch },
	{
		name: 'search dropdown with results',
		path: '/?tab=popular',
		layouts: DESKTOP,
		enter: dropdownWithResults,
		crossBrowser: true
	},
	{
		name: 'search dropdown, an option active',
		path: '/',
		layouts: DESKTOP,
		enter: (page, lang) => withActiveOption(page, dropdownWithResults, lang)
	},
	{ name: 'search dropdown, no match', path: '/', layouts: DESKTOP, enter: dropdownWithNoMatch },
	{ name: 'language menu open', path: '/', layouts: BOTH, enter: openMenu, crossBrowser: true },
	{
		name: 'language menu open on a dish page',
		path: '/dishes/tortilla',
		layouts: DESKTOP,
		enter: openMenu
	},
	{ name: 'Variations', path: '/dishes/tortilla', layouts: BOTH },
	{ name: 'Recipe', path: '/dishes/tortilla/gal', layouts: BOTH, crossBrowser: true },
	{
		name: '404 page',
		path: '/dishes/nope',
		layouts: BOTH,
		status: NOT_FOUND,
		crossBrowser: true
	}
];

// Without JavaScript the language button is a <summary> that opens its
// <details> natively (FE-7 PR 3).
async function openDetailsMenu(page: Page) {
	const summary = page.locator('summary').filter({ visible: true });
	await summary.click();
	await expect(page.locator('details[open]').filter({ visible: true })).toHaveCount(1);
}

// The route types the server renders without JavaScript, and its one overlay.
export const NO_JS_STATES: UiState[] = [
	...UI_STATES.filter((state) => !state.enter),
	{ name: 'region page', path: '/regions/gal', layouts: BOTH },
	{ name: 'language menu open', path: '/', layouts: BOTH, enter: openDetailsMenu }
];

const OK = 200;

// Loads the page (hydrated, when JavaScript runs) and checks its status.
export async function gotoStatus(page: Page, url: string, status = OK) {
	const res = await page.goto(url, { waitUntil: 'networkidle' });
	expect(res?.status(), `got status ${res?.status()} for ${url}, want ${status}`).toBe(status);
}

// Nothing animates any more: what is measured or scanned is the resting state.
export async function expectPageSettled(page: Page) {
	const settled = () =>
		page.evaluate(() => document.getAnimations().every((a) => a.playState !== 'running'));
	await expect
		.poll(settled, { message: 'want every animation and transition finished' })
		.toBe(true);
}

// The server render as a browser without JavaScript shows it, in a page
// that can still run axe: Playwright's javaScriptEnabled: false also stops
// axe's own timers, so instead the document arrives with every <script>
// removed and the app never boots (the app has no <noscript> content).
const SCRIPT_ELEMENT = /<script\b[\s\S]*?<\/script>/gi;

export async function gotoServerRender(page: Page, state: UiState, lang: Locale) {
	const url = `/${lang}${state.path}`;
	await page.route(
		(target) => target.pathname + target.search === url,
		async (route) => {
			const response = await route.fetch();
			const body = (await response.text()).replace(SCRIPT_ELEMENT, '');
			await route.fulfill({ response, body });
		}
	);
	await gotoStatus(page, url, state.status);
	const scripts = await page.locator('script').count();
	expect(scripts, 'got scripts in the server render, want none').toBe(0);
	await state.enter?.(page, lang);
	await expectPageSettled(page);
}

export async function enterState(page: Page, state: UiState, lang: Locale, origin = '') {
	await gotoStatus(page, `${origin}/${lang}${state.path}`, state.status);
	await state.enter?.(page, lang);
	await expectPageSettled(page);
}

export const stateTitle = (state: UiState, lang: Locale) => `/${lang}${state.path}: ${state.name}`;

export const crossBrowserTag = (state: UiState, lang: Locale): string[] =>
	state.crossBrowser && lang === 'en' ? ['@cross-browser'] : [];
