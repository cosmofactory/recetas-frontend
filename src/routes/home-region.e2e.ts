import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';
import {
	expectSameDocument,
	gotoHydrated,
	isDesktopPage,
	markDocument,
	onlyVisible,
	pathAndQuery,
	tokenValue,
	visibleMap
} from '../testutil/home-e2e';
import {
	activateRegion,
	ANDALUCIA_EN,
	ANDALUCIA_RU_NAME,
	expectSheetExpanded,
	expectSheetHidden,
	expectSheetPeek,
	GALICIA_EN,
	GALICIA_RU,
	HANDLE_LABEL_EN,
	historyLength,
	recipeUrl,
	recordedSheet,
	recordSheet,
	regionLink,
	regionPanel,
	regionSheet,
	rowLinks,
	selectedRegions,
	tapRegion,
	tapScrim,
	type RegionCopy
} from '../testutil/region-e2e';

// FE-4 PR 3, region details on the home screen (stage FE-4 -> Delivery 3,
// Region sheet, Desktop Regional, Selection state, Acceptance).
//
// Mobile (< 860px; mobile README -> Regional tab — Region sheet L66–80,
// State L186–200, Accessibility L202–205):
// - "Tapping a map region → peek, showing that region. Tapping the handle
//   area toggles peek ↔ expanded. Tapping the scrim → hidden and
//   deselects." "Sheets: focus-trap when expanded, Escape closes."
// - Stage FE-4 -> URL ↔ state: a tap navigates to /:lang/regions/:key and
//   the sheet opens in peek; Small decisions: "Tapping the scrim navigates to
//   /:lang/ (a new history entry, so Back reopens the region)". The sheet
//   lives in the (home) layout, so moving between regions keeps it mounted
//   ("the sheet animates; no remount").
// - CLAUDE.md containers: focus returns to the opener once the sheet hides.
//
// Desktop (≥ 860px; desktop README -> Regional L56): "Right: region panel,
// always visible (no sheet) ... Clicking a row opens that variation's
// recipe. Andalucía is selected on first load." Stage FE-4: "Andalucía is
// selected by default only when the URL has no region (/:lang/). The
// default isn't written into the URL".
//
// Decisions pinned here (FE-4 PR 3 report):
// - Escape is the keyboard twin of the scrim: it navigates to /:lang/ as a
//   new history entry too, so Back reopens the region either way.
// - The expanded state is local (the URL stays /:lang/regions/:key and no
//   history entry is added); a region URL always opens in peek.
// - With the sheet in peek its scrim covers the map, so another region is
//   reached by keyboard (or history), and the sheet switches content without
//   passing through hidden.
// - Focus: activating a map region keeps focus on its link (the navigation
//   doesn't reset focus), so closing returns focus to that link.
// - On desktop the map shows the default Andalucía as selected
//   (aria-current="true") once hydrated; on mobile /:lang/ selects nothing.

const PEEK = 'peek';

function skipUnlessMobile(page: Page) {
	test.skip(isDesktopPage(page), 'mobile region sheet (< 860px)');
}

function skipUnlessDesktop(page: Page) {
	test.skip(!isDesktopPage(page), 'desktop region panel (≥ 860px)');
}

async function expectSheetShows(page: Page, lang: string, region: RegionCopy) {
	const sheet = regionSheet(page);
	await expect(sheet.getByText(region.description, { exact: true })).toHaveCount(1);
	await expect(sheet.getByText(region.count, { exact: true })).toHaveCount(1);
	for (const link of rowLinks(sheet, lang, region)) await expect(link).toHaveCount(1);
}

test.describe('mobile region sheet: opening', () => {
	test.beforeEach(({ page }) => skipUnlessMobile(page));

	test('/en/: the sheet is hidden and no region is selected', async ({ page }) => {
		await gotoHydrated(page, '/en/');
		await expectSheetHidden(page);
		await expect(selectedRegions(page)).toHaveCount(0);
	});

	test('tapping a region opens /en/regions/:key with its sheet in peek', async ({ page }) => {
		await gotoHydrated(page, '/en/');
		await markDocument(page);
		await tapRegion(page, 'gal');
		await expectSameDocument(page, 'tapping a region');
		await expectSheetPeek(page, GALICIA_EN.name);
		await expectSheetShows(page, 'en', GALICIA_EN);
		await expect(regionLink(page, 'gal')).toHaveAttribute('aria-current', 'true');
	});

	test('a region deep link opens its sheet in peek', async ({ page }) => {
		await gotoHydrated(page, '/ru/regions/gal');
		await expectSheetPeek(page, GALICIA_RU.name);
		await expectSheetShows(page, 'ru', GALICIA_RU);
	});

	test('no desktop panel is shown on mobile', async ({ page }) => {
		await gotoHydrated(page, '/en/regions/gal');
		await expect(regionPanel(page, GALICIA_EN.name)).toHaveCount(0);
	});
});

test.describe('mobile region sheet: handle', () => {
	test.beforeEach(({ page }) => skipUnlessMobile(page));

	test('the handle toggles peek ↔ expanded; the URL and history stay', async ({ page }) => {
		await gotoHydrated(page, '/en/regions/gal');
		const entries = await historyLength(page);
		const handle = regionSheet(page).getByRole('button', { name: HANDLE_LABEL_EN, exact: true });
		await handle.click();
		await expectSheetExpanded(page, GALICIA_EN.name);
		expect(pathAndQuery(page), 'got the URL changed by expanding').toBe('/en/regions/gal');
		await handle.click();
		await expectSheetPeek(page, GALICIA_EN.name);
		expect(pathAndQuery(page), 'got the URL changed by collapsing').toBe('/en/regions/gal');
		expect(await historyLength(page), 'got a history entry for the handle').toBe(entries);
	});

	test('expanded traps focus in the sheet', async ({ page }) => {
		await gotoHydrated(page, '/en/regions/gal');
		await regionSheet(page).getByRole('button', { name: HANDLE_LABEL_EN }).click();
		await expectSheetExpanded(page, GALICIA_EN.name);
		for (let i = 0; i < GALICIA_EN.rows.length + 3; i++) {
			await page.keyboard.press('Tab');
			const inside = await regionSheet(page).evaluate((el) => el.contains(document.activeElement));
			expect(inside, `got focus out of the expanded sheet after ${i + 1} Tabs`).toBe(true);
		}
	});

	test('expanded: a row opens its recipe', async ({ page }) => {
		await gotoHydrated(page, '/en/regions/gal');
		await regionSheet(page).getByRole('button', { name: HANDLE_LABEL_EN }).click();
		await expectSheetExpanded(page, GALICIA_EN.name);
		const last = GALICIA_EN.rows[GALICIA_EN.rows.length - 1];
		await regionSheet(page)
			.locator(`a[href="${recipeUrl('en', last, 'gal')}"]`)
			.click();
		await page.waitForURL((url) => url.pathname === recipeUrl('en', last, 'gal'));
	});
});

test.describe('mobile region sheet: closing', () => {
	test.beforeEach(({ page }) => skipUnlessMobile(page));

	test('tapping the scrim goes to /en/, hides the sheet and deselects', async ({ page }) => {
		await gotoHydrated(page, '/en/');
		await tapRegion(page, 'gal');
		await expectSheetPeek(page, GALICIA_EN.name);
		await tapScrim(page);
		await page.waitForURL((url) => url.pathname === '/en/');
		expect(pathAndQuery(page)).toBe('/en/');
		await expectSheetHidden(page);
		await expect(selectedRegions(page)).toHaveCount(0);
	});

	test('the scrim close is a new history entry: Back reopens the region in peek', async ({
		page
	}) => {
		await gotoHydrated(page, '/en/regions/gal');
		await expectSheetPeek(page, GALICIA_EN.name);
		await tapScrim(page);
		await page.waitForURL((url) => url.pathname === '/en/');
		await page.goBack();
		await page.waitForURL((url) => url.pathname === '/en/regions/gal');
		await expectSheetPeek(page, GALICIA_EN.name);
		await expectSheetShows(page, 'en', GALICIA_EN);
	});

	test('Escape closes like the scrim: /en/, hidden, and Back reopens', async ({ page }) => {
		await gotoHydrated(page, '/en/regions/gal');
		await expectSheetPeek(page, GALICIA_EN.name);
		await page.keyboard.press('Escape');
		await page.waitForURL((url) => url.pathname === '/en/');
		await expectSheetHidden(page);
		await page.goBack();
		await page.waitForURL((url) => url.pathname === '/en/regions/gal');
		await expectSheetPeek(page, GALICIA_EN.name);
	});

	test('Escape closes the expanded sheet too', async ({ page }) => {
		await gotoHydrated(page, '/en/regions/gal');
		await regionSheet(page).getByRole('button', { name: HANDLE_LABEL_EN }).click();
		await expectSheetExpanded(page, GALICIA_EN.name);
		await page.keyboard.press('Escape');
		await page.waitForURL((url) => url.pathname === '/en/');
		await expectSheetHidden(page);
	});

	test('Back from a region to /en/ hides the sheet', async ({ page }) => {
		await gotoHydrated(page, '/en/');
		await tapRegion(page, 'gal');
		await expectSheetPeek(page, GALICIA_EN.name);
		await page.goBack();
		await page.waitForURL((url) => url.pathname === '/en/');
		await expectSheetHidden(page);
	});
});

test.describe('mobile region sheet: switching regions', () => {
	test.beforeEach(({ page }) => skipUnlessMobile(page));

	test('another region (keyboard) switches the content without closing', async ({ page }) => {
		await gotoHydrated(page, '/en/regions/gal');
		await expectSheetPeek(page, GALICIA_EN.name);
		await recordSheet(page);
		await activateRegion(page, 'and');
		await expectSheetPeek(page, ANDALUCIA_EN.name);
		await expectSheetShows(page, 'en', ANDALUCIA_EN);
		const { states, same } = await recordedSheet(page);
		expect(same, 'got a new sheet element, want it kept mounted').toBe(true);
		expect(states, `got data-state ${JSON.stringify(states)}, want it never hidden`).not.toContain(
			'hidden'
		);
	});

	test('Back from one region to another keeps the sheet open', async ({ page }) => {
		await gotoHydrated(page, '/en/regions/gal');
		await activateRegion(page, 'and');
		await expectSheetPeek(page, ANDALUCIA_EN.name);
		await recordSheet(page);
		await page.goBack();
		await page.waitForURL((url) => url.pathname === '/en/regions/gal');
		await expectSheetPeek(page, GALICIA_EN.name);
		const { states } = await recordedSheet(page);
		expect(states, `got data-state ${JSON.stringify(states)}`).not.toContain('hidden');
	});
});

test.describe('mobile region sheet: focus return', () => {
	test.beforeEach(({ page }) => skipUnlessMobile(page));

	test('closing from peek returns focus to the map region that opened it', async ({ page }) => {
		await gotoHydrated(page, '/en/');
		await activateRegion(page, 'gal');
		await expectSheetPeek(page, GALICIA_EN.name);
		await page.keyboard.press('Escape');
		await page.waitForURL((url) => url.pathname === '/en/');
		await expectSheetHidden(page);
		await expect(regionLink(page, 'gal'), 'want focus back on the Galicia link').toBeFocused();
	});

	// WebKit guard: WebKit doesn't focus a link on click, so the sheet must
	// return focus to the tapped region without relying on it. Chromium does
	// focus it, so the test cancels mousedown (no focus move, the click still
	// navigates) to stand in for WebKit.
	test('closing after a pointer tap returns focus to the tapped region', async ({ page }) => {
		await gotoHydrated(page, '/en/');
		await regionLink(page, 'gal').evaluate((link) =>
			link.addEventListener('mousedown', (event) => event.preventDefault())
		);
		await tapRegion(page, 'gal');
		await expectSheetPeek(page, GALICIA_EN.name);
		await expect(regionLink(page, 'gal'), 'want the tap to leave focus alone').not.toBeFocused();
		await page.keyboard.press('Escape');
		await page.waitForURL((url) => url.pathname === '/en/');
		await expectSheetHidden(page);
		await expect(
			regionLink(page, 'gal'),
			'want focus back on the tapped Galicia link'
		).toBeFocused();
	});

	test('closing from expanded returns focus to the map region too', async ({ page }) => {
		await gotoHydrated(page, '/en/');
		await activateRegion(page, 'gal');
		const handle = regionSheet(page).getByRole('button', { name: HANDLE_LABEL_EN });
		await handle.focus();
		await page.keyboard.press('Enter');
		await expectSheetExpanded(page, GALICIA_EN.name);
		await page.keyboard.press('Escape');
		await page.waitForURL((url) => url.pathname === '/en/');
		await expectSheetHidden(page);
		await expect(regionLink(page, 'gal'), 'want focus back on the Galicia link').toBeFocused();
	});
});

test.describe('mobile region sheet without JavaScript', () => {
	test.use({ javaScriptEnabled: false });
	test.beforeEach(({ page }) => skipUnlessMobile(page));

	test('/ru/regions/gal: the server-rendered sheet rests in peek in Russian', async ({ page }) => {
		await page.goto('/ru/regions/gal');
		await expectSheetPeek(page, GALICIA_RU.name);
		await expectSheetShows(page, 'ru', GALICIA_RU);
		const first = regionSheet(page).getByText(GALICIA_RU.description, { exact: true });
		await expect(first).toBeInViewport();
	});

	test('/en/: the server-rendered sheet is hidden', async ({ page }) => {
		await page.goto('/en/');
		await expectSheetHidden(page);
	});
});

test.describe('desktop region panel', () => {
	test.beforeEach(({ page }) => skipUnlessDesktop(page));

	test('/en/ shows Andalucía, selected on the map, and the URL stays /en/', async ({ page }) => {
		await gotoHydrated(page, '/en/');
		const panel = regionPanel(page, ANDALUCIA_EN.name);
		await expect(panel).toBeVisible();
		await expect(panel.getByRole('heading', { level: 2, name: ANDALUCIA_EN.name })).toBeVisible();
		await expect(panel.getByText(ANDALUCIA_EN.count, { exact: true })).toBeVisible();
		await expect(panel.getByText(ANDALUCIA_EN.description, { exact: true })).toBeVisible();
		for (const link of rowLinks(panel, 'en', ANDALUCIA_EN)) await expect(link).toBeVisible();
		await expect(selectedRegions(page)).toHaveCount(1);
		await expect(regionLink(page, 'and')).toHaveAttribute('aria-current', 'true');
		expect(pathAndQuery(page), 'got the default written into the URL').toBe('/en/');
	});

	test('/en/regions/gal shows Galicia, selected on the map', async ({ page }) => {
		await gotoHydrated(page, '/en/regions/gal');
		const panel = regionPanel(page, GALICIA_EN.name);
		await expect(panel).toBeVisible();
		for (const chip of GALICIA_EN.chips) {
			await expect(panel.getByText(chip, { exact: true })).toBeVisible();
		}
		for (const link of rowLinks(panel, 'en', GALICIA_EN)) await expect(link).toBeVisible();
		await expect(regionPanel(page, ANDALUCIA_EN.name)).toHaveCount(0);
		await expect(selectedRegions(page)).toHaveCount(1);
		await expect(regionLink(page, 'gal')).toHaveAttribute('aria-current', 'true');
	});

	test('/ru/ shows the default region in Russian', async ({ page }) => {
		await gotoHydrated(page, '/ru/');
		await expect(regionPanel(page, ANDALUCIA_RU_NAME)).toBeVisible();
	});

	test('clicking a region shows it in the panel without a reload', async ({ page }) => {
		await gotoHydrated(page, '/en/');
		await markDocument(page);
		await tapRegion(page, 'gal');
		await expectSameDocument(page, 'clicking a region');
		await expect(regionPanel(page, GALICIA_EN.name)).toBeVisible();
		await expect(regionLink(page, 'gal')).toHaveAttribute('aria-current', 'true');
		await expect(selectedRegions(page)).toHaveCount(1);
	});

	test('Back from a region returns the panel to Andalucía', async ({ page }) => {
		await gotoHydrated(page, '/en/');
		await tapRegion(page, 'gal');
		await page.goBack();
		await page.waitForURL((url) => url.pathname === '/en/');
		await expect(regionPanel(page, ANDALUCIA_EN.name)).toBeVisible();
		await expect(regionLink(page, 'and')).toHaveAttribute('aria-current', 'true');
	});

	test('clicking a panel row opens that variation’s recipe', async ({ page }) => {
		await gotoHydrated(page, '/en/regions/gal');
		const row = GALICIA_EN.rows[2];
		await regionPanel(page, GALICIA_EN.name)
			.locator(`a[href="${recipeUrl('en', row, 'gal')}"]`)
			.click();
		await page.waitForURL((url) => url.pathname === recipeUrl('en', row, 'gal'));
		await expect(page.getByRole('heading', { level: 1, name: row.name })).toBeVisible();
	});

	test('no sheet and no scrim: the map takes the pointer', async ({ page }) => {
		await gotoHydrated(page, '/en/regions/gal');
		await expect(onlyVisible(page.getByRole('dialog'))).toHaveCount(0);
		const cell = regionLink(page, 'cat').locator('[data-map-cell]').first();
		const box = await cell.boundingBox();
		expect(box, 'got no Catalonia cell').not.toBeNull();
		const hit = await page.evaluate(
			([x, y]) => document.elementFromPoint(x, y)?.hasAttribute('data-map-cell') ?? false,
			[box!.x + box!.width / 2, box!.y + box!.height / 2] as const
		);
		expect(hit, 'got something over the map, want the cell itself').toBe(true);
	});
});

test.describe('desktop region panel without JavaScript', () => {
	test.use({ javaScriptEnabled: false });
	test.beforeEach(({ page }) => skipUnlessDesktop(page));

	test('/en/ server-renders Andalucía in the panel', async ({ page }) => {
		await page.goto('/en/');
		await expect(regionPanel(page, ANDALUCIA_EN.name)).toBeVisible();
	});

	test('/ru/regions/gal server-renders Галисия in the panel', async ({ page }) => {
		await page.goto('/ru/regions/gal');
		const panel = regionPanel(page, GALICIA_RU.name);
		await expect(panel).toBeVisible();
		await expect(panel.getByText(GALICIA_RU.count, { exact: true })).toBeVisible();
	});
});

// Decision: the region name is an <h2> in both layouts; the page's one
// visible <h1> stays the mobile logo / the desktop "How Spain really cooks".
test.describe('region page headings', () => {
	test('/en/regions/gal: one visible <h1> and the region name as a visible <h2>', async ({
		page
	}) => {
		await gotoHydrated(page, '/en/regions/gal');
		await expect(onlyVisible(page.locator('h1')), 'want exactly one visible <h1>').toHaveCount(1);
		const h2 = page.getByRole('heading', { level: 2, name: GALICIA_EN.name, exact: true });
		await expect(onlyVisible(h2), 'want Galicia as one visible <h2>').toHaveCount(1);
	});
});

// Stage FE-4 -> Selection state: "Crossing 860px keeps the selection: a
// mobile sheet in peek ↔ the desktop panel"; the desktop default is not a
// selection, so it never opens the mobile sheet. Resizing is the same in
// every project, so it runs in one.
test.describe('resizing across 860px', () => {
	const PROJECT = 'chromium-desktop-1280';
	const MOBILE = { width: 390, height: 844 };
	const DESKTOP = { width: 1280, height: 800 };

	const onlyInResizeProject = (testInfo: TestInfo) =>
		test.skip(testInfo.project.name !== PROJECT, `resize checks run in ${PROJECT} only`);

	// FE-4 PR 3 review: the expanded state is local and "a region URL always
	// opens in peek", so leaving the mobile layout and coming back resets it:
	// peek, not modal, and focus is not pulled into the sheet.
	test('expanded, then desktop and back: the sheet is in peek and focus stays out', async ({
		page
	}, testInfo) => {
		onlyInResizeProject(testInfo);
		await page.setViewportSize(MOBILE);
		await gotoHydrated(page, '/en/regions/gal');
		await regionSheet(page).getByRole('button', { name: HANDLE_LABEL_EN }).click();
		await expectSheetExpanded(page, GALICIA_EN.name);
		await page.setViewportSize(DESKTOP);
		await expect(regionPanel(page, GALICIA_EN.name)).toBeVisible();
		await page.setViewportSize(MOBILE);
		await expectSheetPeek(page, GALICIA_EN.name);
		const focusInSheet = await regionSheet(page).evaluate((el) =>
			el.contains(document.activeElement)
		);
		expect(focusInSheet, 'got focus pulled into the sheet on resize').toBe(false);
	});

	test('/en/regions/gal: mobile peek ↔ desktop panel, both Galicia', async ({ page }, testInfo) => {
		onlyInResizeProject(testInfo);
		await page.setViewportSize(MOBILE);
		await gotoHydrated(page, '/en/regions/gal');
		await expectSheetPeek(page, GALICIA_EN.name);
		await page.setViewportSize(DESKTOP);
		await expect(regionPanel(page, GALICIA_EN.name)).toBeVisible();
		await expect(onlyVisible(page.getByRole('dialog'))).toHaveCount(0);
		await page.setViewportSize(MOBILE);
		await expectSheetPeek(page, GALICIA_EN.name);
		expect(pathAndQuery(page)).toBe('/en/regions/gal');
	});

	test('/en/: the desktop default never opens the mobile sheet', async ({ page }, testInfo) => {
		onlyInResizeProject(testInfo);
		await page.setViewportSize(DESKTOP);
		await gotoHydrated(page, '/en/');
		await expect(regionPanel(page, ANDALUCIA_EN.name)).toBeVisible();
		await expect(regionLink(page, 'and')).toHaveAttribute('aria-current', 'true');
		await page.setViewportSize(MOBILE);
		await expect(regionSheet(page)).toHaveAttribute('data-state', 'hidden');
		await expectSheetHidden(page);
		await expect(selectedRegions(page), 'got the desktop default selected on mobile').toHaveCount(
			0
		);
		await page.setViewportSize(DESKTOP);
		await expect(regionLink(page, 'and')).toHaveAttribute('aria-current', 'true');
		expect(pathAndQuery(page)).toBe('/en/');
	});

	test('a mobile tap, then desktop: the panel shows the tapped region', async ({
		page
	}, testInfo) => {
		onlyInResizeProject(testInfo);
		await page.setViewportSize(MOBILE);
		await gotoHydrated(page, '/en/');
		await tapRegion(page, 'gal');
		await expect(regionSheet(page)).toHaveAttribute('data-state', PEEK);
		await page.setViewportSize(DESKTOP);
		await expect(regionPanel(page, GALICIA_EN.name)).toBeVisible();
		await expect(visibleMap(page)).toHaveCount(1);
	});
});

// FE-4 PR 3 review: a new region's details start at the top. The panel (and
// the mobile sheet body) is one scroller kept mounted across region changes,
// so without a reset the next region would open part-way down its list.
async function scrollToBottom(container: Locator): Promise<number> {
	return container.evaluate((root) => {
		const scrolls = (el: Element) =>
			['auto', 'scroll'].includes(getComputedStyle(el).overflowY) &&
			el.scrollHeight > el.clientHeight;
		const scroller = [root, ...root.querySelectorAll('*')].find(scrolls);
		if (!scroller) return 0;
		scroller.scrollTop = scroller.scrollHeight;
		return scroller.scrollTop;
	});
}

async function maxScrollTop(container: Locator): Promise<number> {
	return container.evaluate((root) =>
		Math.max(...[root, ...root.querySelectorAll('*')].map((el) => el.scrollTop))
	);
}

test.describe('region details start scrolled to the top', () => {
	test('desktop: scroll Andalucía down, click Galicia → the panel is back at the top', async ({
		page
	}) => {
		skipUnlessDesktop(page);
		await page.setViewportSize({ width: 1280, height: 800 });
		await gotoHydrated(page, '/en/');
		const scrolled = await scrollToBottom(regionPanel(page, ANDALUCIA_EN.name));
		expect(scrolled, 'want the Andalucía panel to scroll at 1280×800').toBeGreaterThan(0);
		await tapRegion(page, 'gal');
		const panel = regionPanel(page, GALICIA_EN.name);
		await expect(panel).toBeVisible();
		await expect.poll(() => maxScrollTop(panel), { message: 'want the panel at the top' }).toBe(0);
		await expect(panel.getByRole('heading', { level: 2, name: GALICIA_EN.name })).toBeInViewport();
	});

	test('mobile: scroll the Andalucía sheet down, switch to Galicia → its body is at the top', async ({
		page
	}) => {
		skipUnlessMobile(page);
		// A short frame, so the peek sheet body has to scroll.
		await page.setViewportSize({ width: 390, height: 600 });
		await gotoHydrated(page, '/en/regions/and');
		await expectSheetPeek(page, ANDALUCIA_EN.name);
		const scrolled = await scrollToBottom(regionSheet(page));
		expect(scrolled, 'want the Andalucía sheet body to scroll').toBeGreaterThan(0);
		await activateRegion(page, 'gal');
		await expectSheetPeek(page, GALICIA_EN.name);
		await expect
			.poll(() => maxScrollTop(regionSheet(page)), { message: 'want the sheet body at the top' })
			.toBe(0);
	});
});

// FE-4 PR 3 review, Andalucía without JavaScript. The server can't know the
// width, so it renders the mobile selection (none) and aria-current stays
// client-only (decision: an SSR aria-current would be wrong below 860px,
// where /:lang/ selects nothing). The desktop default must still LOOK
// selected from the HTML and CSS alone, and only at ≥ 860px.
async function selectedCellCount(page: Page, regionKey: string | null): Promise<number> {
	const ink = await tokenValue(page, 'background-color', 'var(--region-selected)');
	const cells = regionKey
		? regionLink(page, regionKey).locator('[data-map-cell]')
		: visibleMap(page).locator('[data-map-cell]');
	const colours = await cells.evaluateAll((els) =>
		els.map((el) => getComputedStyle(el).backgroundColor)
	);
	return colours.filter((colour) => colour === ink).length;
}

test.describe('the desktop default selection without JavaScript', () => {
	test.use({ javaScriptEnabled: false });

	test('≥ 860px /en/: Andalucía’s cells, and only those, are --region-selected', async ({
		page
	}) => {
		skipUnlessDesktop(page);
		await page.goto('/en/');
		const andalucia = await regionLink(page, 'and').locator('[data-map-cell]').count();
		expect(await selectedCellCount(page, 'and'), 'want every Andalucía cell ink').toBe(andalucia);
		expect(await selectedCellCount(page, null), 'got other regions drawn selected').toBe(andalucia);
	});

	test('≥ 860px /en/: aria-current stays client-only', async ({ page }) => {
		skipUnlessDesktop(page);
		await page.goto('/en/');
		await expect(selectedRegions(page)).toHaveCount(0);
	});

	test('< 860px /en/: no region looks selected', async ({ page }) => {
		skipUnlessMobile(page);
		await page.goto('/en/');
		expect(await selectedCellCount(page, null), 'got a region drawn selected on mobile').toBe(0);
	});
});

// FE-4 PR 3 QA: the desktop home was 801px tall at 1280×800. The top bar is
// 76px plus its 1px hairline (prototype content-box, DesktopTopBar spec), the
// grid pads 28px + 36px and the panel is calc(100vh − 141px) (StickyPanel
// spec), so the page is exactly one viewport tall and never scrolls there.
test.describe('desktop home fits the viewport', () => {
	const viewports = [
		{ width: 1280, height: 800 },
		{ width: 1440, height: 900 }
	];
	for (const viewport of viewports) {
		for (const url of ['/en/', '/en/regions/gal']) {
			test(`${viewport.width}×${viewport.height} ${url}: the document does not scroll`, async ({
				page
			}) => {
				skipUnlessDesktop(page);
				await page.setViewportSize(viewport);
				await gotoHydrated(page, url);
				const { scrollHeight, innerHeight } = await page.evaluate(() => ({
					scrollHeight: document.documentElement.scrollHeight,
					innerHeight: window.innerHeight
				}));
				expect(
					scrollHeight,
					`got ${scrollHeight}px of document for ${innerHeight}px`
				).toBeLessThanOrEqual(innerHeight);
			});
		}
	}
});
