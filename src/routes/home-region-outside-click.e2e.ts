import { expect, test, type Page } from '../testutil/e2e-test';
import {
	desktopSearchField,
	desktopSearchInput,
	searchDropdown
} from '../testutil/desktop-search-e2e';
import { gotoHydrated, HOME_COPY, isDesktopPage, pathAndQuery, tab } from '../testutil/home-e2e';
import { languageButton, languageMenu } from '../testutil/language-menu-e2e';
import {
	aboutBlock,
	afterFrames,
	aboutParagraph,
	belowAboutPoint,
	besideAboutPoint,
	clickEmptySpace,
	clickPanelItself,
	dragBetween,
	expectStillSelected,
	focusedTag,
	mapGapPoint,
	panelPaddingPoint,
	seaPoint,
	selectedText,
	textStartPoint,
	topBarSpacerPoint,
	type Point
} from '../testutil/outside-click-e2e';
import {
	expectCleared,
	expectSheetPeek,
	GALICIA_EN,
	historyLength,
	recipeUrl,
	regionLink,
	regionPanel,
	regionSheet,
	rowLinks,
	tapRegion
} from '../testutil/region-e2e';
import { expectMapSelection } from '../testutil/map-dim-e2e';

// FE-9 FB-14, spec change D-FE9-9 (owner, 2026-11-03; desktop README ->
// Regional L56): with a region selected, "clicking the selected region
// again, Esc, or a click on empty space outside the panel (the map's gaps
// and sea, the page background, the about block outside its links) clears
// it back to /:lang/. Clicks inside the panel, on the top bar, or on any
// link or control do not clear." Stage FE-9 FB-14: a plain primary click,
// through the same close path as Esc (a history entry; focus is not
// stolen). Mirrors the mobile scrim; mobile is unchanged.
//
// Decisions pinned here (see the FB-14 test report):
// - The about block has no links, so all of it (title and paragraph) is
//   empty space.
// - A click on the Popular tab is the tab's own navigation, never a clear
//   first; the Regional tab already links to /:lang/ by itself, so it can't
//   tell a clear apart and isn't used here.
// - "Focus is not stolen": after a clearing click focus stays where the
//   browser put it (a press on non-focusable space leaves it on <body>); the
//   clear doesn't move it to the map link or into the panel.

const GAL = GALICIA_EN.key;

// Inside the page's side padding (at least 24px from 860px), below the top bar.
const POPULAR_GUTTER: Point = { x: 4, y: 200 };

function skipUnlessDesktop(page: Page) {
	test.skip(!isDesktopPage(page), 'desktop region panel (≥ 860px)');
}

// Opens Galicia from the bare home with a click, as a user would.
async function selectGalicia(page: Page) {
	await gotoHydrated(page, '/en/');
	await tapRegion(page, GAL);
	await expectMapSelection(page, GAL);
}

const galiciaPanel = (page: Page) => regionPanel(page, GALICIA_EN.name);

test.describe('desktop: a click on empty space clears the selected region', () => {
	test.beforeEach(({ page }) => skipUnlessDesktop(page));

	const emptySpots: { name: string; point: (page: Page) => Promise<Point>; tag?: string[] }[] = [
		{ name: 'a sea cell of the map', point: seaPoint, tag: ['@cross-browser'] },
		{ name: 'the gap between two map cells', point: mapGapPoint },
		{ name: 'the page gutter beside the about block', point: besideAboutPoint },
		{ name: 'the page background below the about block', point: belowAboutPoint }
	];
	for (const spot of emptySpots) {
		test(`a click on ${spot.name}: back to /en/`, { tag: spot.tag ?? [] }, async ({ page }) => {
			await selectGalicia(page);
			await clickEmptySpace(page, await spot.point(page), spot.name);
			await expectCleared(page);
		});
	}

	test('a click on the about paragraph clears (the block has no links)', async ({ page }) => {
		await selectGalicia(page);
		await expect(aboutBlock(page).locator('a')).toHaveCount(0);
		await aboutParagraph(page).click();
		await expectCleared(page);
	});

	test('a click on the about title clears', async ({ page }) => {
		await selectGalicia(page);
		await page.getByRole('heading', { level: 1, name: HOME_COPY.en.aboutTitle }).click();
		await expectCleared(page);
	});

	test('a cold load of /ru/regions/gal, then a sea click: back to /ru/', async ({ page }) => {
		await gotoHydrated(page, '/ru/regions/gal');
		await clickEmptySpace(page, await seaPoint(page), 'a sea cell');
		await expectCleared(page, 'ru');
	});

	test(
		'clearing by an empty-space click is a new entry: Back reselects Galicia',
		{ tag: '@cross-browser' },
		async ({ page }) => {
			await selectGalicia(page);
			const entries = await historyLength(page);
			await clickEmptySpace(page, await seaPoint(page), 'a sea cell');
			await expectCleared(page);
			expect(await historyLength(page), 'want a new history entry').toBe(entries + 1);
			await page.goBack();
			await page.waitForURL((url) => url.pathname === '/en/regions/gal');
			await expect(galiciaPanel(page)).toBeVisible();
			await expectMapSelection(page, GAL);
		}
	);

	test('a clearing click does not move focus', async ({ page }) => {
		await selectGalicia(page);
		await clickEmptySpace(page, await seaPoint(page), 'a sea cell');
		await expectCleared(page);
		expect(await focusedTag(page), 'want focus left on <body>, not moved').toBe('BODY');
	});
});

test.describe('desktop: clicks that keep the selected region', () => {
	test.beforeEach(({ page }) => skipUnlessDesktop(page));

	test('a click on the panel’s own padding', async ({ page }) => {
		await selectGalicia(page);
		const entries = await historyLength(page);
		const panel = galiciaPanel(page);
		await clickPanelItself(page, panel, await panelPaddingPoint(panel));
		await expectStillSelected(page, GAL, entries);
	});

	const panelTexts = [
		{ name: 'the region description', text: GALICIA_EN.description },
		{ name: 'a regional dish chip (a plain label)', text: GALICIA_EN.chips[0] },
		{ name: 'the variation count', text: GALICIA_EN.count }
	];
	for (const item of panelTexts) {
		test(`a click on ${item.name} in the panel`, async ({ page }) => {
			await selectGalicia(page);
			const entries = await historyLength(page);
			await galiciaPanel(page).getByText(item.text, { exact: true }).click();
			await expectStillSelected(page, GAL, entries);
		});
	}

	test('a click on a panel row opens its recipe, with no clear first', async ({ page }) => {
		await selectGalicia(page);
		const entries = await historyLength(page);
		const [firstRow] = rowLinks(galiciaPanel(page), 'en', GALICIA_EN);
		await firstRow.click();
		const recipe = recipeUrl('en', GALICIA_EN.rows[0], GAL);
		await page.waitForURL((url) => url.pathname === recipe);
		expect(await historyLength(page), 'want exactly one new entry').toBe(entries + 1);
		await page.goBack();
		await page.waitForURL((url) => url.pathname === '/en/regions/gal');
	});

	test('a click on the top bar search field', async ({ page }) => {
		await selectGalicia(page);
		const entries = await historyLength(page);
		await desktopSearchInput(page, 'en').click();
		await expect(searchDropdown(page)).toBeVisible();
		await expectStillSelected(page, GAL, entries);
	});

	test('a click on the language button', async ({ page }) => {
		await selectGalicia(page);
		const entries = await historyLength(page);
		await languageButton(page, 'en').click();
		await expect(languageMenu(page, 'en')).toBeVisible();
		await expectStillSelected(page, GAL, entries);
	});

	test('a click on the top bar’s empty middle', async ({ page }) => {
		await selectGalicia(page);
		const entries = await historyLength(page);
		const point = await topBarSpacerPoint(page, desktopSearchField(page));
		await page.mouse.click(point.x, point.y);
		await expectStillSelected(page, GAL, entries);
	});

	test('a click on the Popular tab goes to Popular, with no clear first', async ({ page }) => {
		await selectGalicia(page);
		const entries = await historyLength(page);
		await tab(page, HOME_COPY.en.popular).filter({ visible: true }).click();
		await page.waitForURL((url) => url.pathname + url.search === '/en/?tab=popular');
		expect(await historyLength(page), 'want exactly one new entry').toBe(entries + 1);
		await page.goBack();
		await page.waitForURL((url) => url.pathname === '/en/regions/gal');
	});

	test('a click on another region switches to it, with no clear first', async ({ page }) => {
		await selectGalicia(page);
		const entries = await historyLength(page);
		await tapRegion(page, 'cat');
		await expectMapSelection(page, 'cat');
		expect(await historyLength(page), 'want exactly one new entry').toBe(entries + 1);
		await page.goBack();
		await page.waitForURL((url) => url.pathname === '/en/regions/gal');
	});

	const otherClicks = [
		{ name: 'an Alt-click', modifier: 'Alt' },
		{ name: 'a Shift-click', modifier: 'Shift' },
		{ name: 'a Ctrl-click', modifier: 'Control' },
		{ name: 'a Meta-click', modifier: 'Meta' }
	];
	for (const click of otherClicks) {
		test(`${click.name} on the sea`, async ({ page }) => {
			await selectGalicia(page);
			const entries = await historyLength(page);
			const sea = await seaPoint(page);
			await page.keyboard.down(click.modifier);
			await page.mouse.click(sea.x, sea.y);
			await page.keyboard.up(click.modifier);
			await expectStillSelected(page, GAL, entries);
		});
	}

	for (const button of ['middle', 'right'] as const) {
		test(`a ${button}-button click on the sea`, async ({ page }) => {
			await selectGalicia(page);
			const entries = await historyLength(page);
			const sea = await seaPoint(page);
			await page.mouse.click(sea.x, sea.y, { button });
			await expectStillSelected(page, GAL, entries);
		});
	}
});

// Review of FB-14: a drag isn't a click on empty space, even when the
// browser fires its click there; both the press and the release must be on
// empty space, and a click that ends a text selection never clears.
test.describe('desktop: a drag never clears the selected region', () => {
	test.beforeEach(({ page }) => skipUnlessDesktop(page));

	test('a text selection dragged from the panel out onto the map', async ({ page }) => {
		await selectGalicia(page);
		const entries = await historyLength(page);
		const description = galiciaPanel(page).getByText(GALICIA_EN.description, { exact: true });
		await dragBetween(page, await textStartPoint(description), await seaPoint(page));
		expect(await selectedText(page), 'want the drag to select text').not.toBe('');
		await expectStillSelected(page, GAL, entries);
	});

	test('a drag-select inside the about paragraph', async ({ page }) => {
		await selectGalicia(page);
		const entries = await historyLength(page);
		const paragraph = aboutParagraph(page);
		await paragraph.scrollIntoViewIfNeeded();
		const start = await textStartPoint(paragraph);
		const box = await paragraph.boundingBox();
		await dragBetween(page, start, { x: start.x + box!.width / 2, y: start.y });
		expect(await selectedText(page), 'want the drag to select text').not.toBe('');
		await expectStillSelected(page, GAL, entries);
	});

	test('a press in the search field released over the sea', async ({ page }) => {
		await selectGalicia(page);
		const entries = await historyLength(page);
		const field = await desktopSearchInput(page, 'en').boundingBox();
		const start = { x: field!.x + field!.width / 2, y: field!.y + field!.height / 2 };
		await dragBetween(page, start, await seaPoint(page));
		await expectStillSelected(page, GAL, entries);
	});
});

// Decision (writer, FB-14): with the search dropdown or the language menu
// open, an empty-space click closes only that overlay and keeps the region,
// as Escape does (the overlay is the higher escape layer).
test.describe('desktop: an empty-space click with an overlay open', () => {
	test.beforeEach(({ page }) => skipUnlessDesktop(page));

	const overlays = [
		{
			name: 'the search dropdown',
			open: (page: Page) => desktopSearchInput(page, 'en').click(),
			overlay: searchDropdown
		},
		{
			name: 'the language menu',
			open: (page: Page) => languageButton(page, 'en').click(),
			overlay: (page: Page) => languageMenu(page, 'en')
		}
	];
	for (const item of overlays) {
		test(`closes only ${item.name}, the region stays`, async ({ page }) => {
			await selectGalicia(page);
			const entries = await historyLength(page);
			await item.open(page);
			await expect(item.overlay(page)).toBeVisible();
			const sea = await seaPoint(page);
			await page.mouse.click(sea.x, sea.y);
			await expect(item.overlay(page)).toBeHidden();
			await expectStillSelected(page, GAL, entries);
		});
	}
});

test.describe('desktop: empty-space clicks with nothing to clear', () => {
	test.beforeEach(({ page }) => skipUnlessDesktop(page));

	test('on /en/ with no region a sea click does not navigate', async ({ page }) => {
		await gotoHydrated(page, '/en/');
		const entries = await historyLength(page);
		await clickEmptySpace(page, await seaPoint(page), 'a sea cell');
		await expectStayed(page, '/en/', entries);
	});

	test('on the Popular tab a click on the page background does not navigate', async ({ page }) => {
		await gotoHydrated(page, '/en/?tab=popular');
		const entries = await historyLength(page);
		await clickEmptySpace(page, POPULAR_GUTTER, 'the page gutter');
		await expectStayed(page, '/en/?tab=popular', entries);
	});
});

async function expectStayed(page: Page, url: string, entries: number) {
	await afterFrames(page);
	expect(pathAndQuery(page)).toBe(url);
	expect(await historyLength(page), 'got a navigation, want none').toBe(entries);
}

test.describe('mobile: the region sheet is unchanged by FB-14', () => {
	test.beforeEach(({ page }) => test.skip(isDesktopPage(page), 'mobile region sheet (< 860px)'));

	test('a tap on the peek sheet’s description keeps it open on the region', async ({ page }) => {
		await gotoHydrated(page, '/en/regions/gal');
		await expectSheetPeek(page, GALICIA_EN.name);
		const entries = await historyLength(page);
		await regionSheet(page).getByText(GALICIA_EN.description, { exact: true }).click();
		await expectSheetPeek(page, GALICIA_EN.name);
		expect(pathAndQuery(page)).toBe('/en/regions/gal');
		expect(await historyLength(page), 'got a navigation, want none').toBe(entries);
		await expect(regionLink(page, GAL)).toHaveAttribute('aria-current', 'true');
	});
});
