import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { expectNoViolations, loadAxe, summary, WCAG_AA_TAGS } from '../testutil/axe-e2e';
import { gotoHydrated } from '../testutil/home-e2e';
import {
	dishCards,
	filterSidebar,
	noMatch,
	openFiltersSheet,
	openFiltersSheetByKeyboard
} from '../testutil/popular-e2e';
import {
	expectSheetExpanded,
	expectSheetPeek,
	GALICIA_EN,
	GALICIA_RU,
	HANDLE_LABEL_EN,
	regionSheet
} from '../testutil/region-e2e';

// FE-4 acceptance: "An axe scan of the page shows no violations."
// stack.md: "Accessibility: WCAG 2.2 AA. Playwright + axe ... check against
// it" (X10). The scan uses @axe-core/playwright (pinned ~4.13.0, a dev
// dependency) with the WCAG 2.0/2.1/2.2 A and AA tags, on the home in both
// tabs and on a region deep link, at one mobile and one desktop size; on
// mobile the region sheet is scanned in peek and expanded.
//
// The module is loaded at run time, so until it is installed this spec
// fails as an assertion naming the package (and type-checks without it).

const MOBILE_PROJECT = 'chromium-mobile-390';
const DESKTOP_PROJECT = 'chromium-desktop-1280';
const SCAN_PROJECTS = [MOBILE_PROJECT, DESKTOP_PROJECT];

function onlyInScanProjects(testInfo: TestInfo) {
	test.skip(
		!SCAN_PROJECTS.includes(testInfo.project.name),
		`axe runs in ${SCAN_PROJECTS.join(', ')}`
	);
}

function onlyOnMobile(testInfo: TestInfo) {
	test.skip(testInfo.project.name !== MOBILE_PROJECT, `the sheet scan runs in ${MOBILE_PROJECT}`);
}

test.describe('axe: WCAG 2.2 AA on the home screens', () => {
	// FE-5 PR 1: Popular filtered (a pressed chip, the ink Filters button), in
	// ru (the longest labels) and with nothing matching (the empty state).
	const urls = [
		'/en/',
		'/en/regions/gal',
		'/ru/regions/gal',
		'/en/?tab=popular',
		'/es/?tab=popular',
		'/ru/?tab=popular&f=vegetarian&f=quick',
		'/en/?tab=popular&f=desserts&f=summer',
		// FE-5 PR 2: the dish sheet in peek on mobile; ignored on desktop.
		'/en/?tab=popular&dish=tortilla',
		'/ru/?tab=popular&f=vegetarian&dish=gazpacho'
	];
	for (const url of urls) {
		test(`${url} has no violations`, async ({ page }, testInfo) => {
			onlyInScanProjects(testInfo);
			await gotoHydrated(page, url);
			await expectNoViolations(page, url);
		});
	}

	test('/en/regions/gal with the sheet in peek has no violations', async ({ page }, testInfo) => {
		onlyOnMobile(testInfo);
		await gotoHydrated(page, '/en/regions/gal');
		await expectSheetPeek(page, GALICIA_EN.name);
		await expectNoViolations(page, '/en/regions/gal (peek)');
	});

	test('/ru/regions/gal with the sheet expanded has no violations', async ({ page }, testInfo) => {
		onlyOnMobile(testInfo);
		await gotoHydrated(page, '/ru/regions/gal');
		await regionSheet(page).locator('button[aria-expanded]').click();
		await expectSheetExpanded(page, GALICIA_RU.name);
		await expectNoViolations(page, '/ru/regions/gal (expanded)');
	});

	test('/en/regions/gal with the sheet expanded has no violations', async ({ page }, testInfo) => {
		onlyOnMobile(testInfo);
		await gotoHydrated(page, '/en/regions/gal');
		await regionSheet(page).getByRole('button', { name: HANDLE_LABEL_EN }).click();
		await expectSheetExpanded(page, GALICIA_EN.name);
		await expectNoViolations(page, '/en/regions/gal (expanded)');
	});
});

// FE-5 PR 2: the dish sheet expanded and the Filters sheet open, on mobile.
test.describe('axe: WCAG 2.2 AA with the Popular sheets open', () => {
	test('/en/?tab=popular&dish=tortilla in peek has no violations', async ({ page }, testInfo) => {
		onlyOnMobile(testInfo);
		await gotoHydrated(page, '/en/?tab=popular&dish=tortilla');
		await expectSheetPeek(page, 'Tortilla de patatas');
		await expectNoViolations(page, '/en/?tab=popular&dish=tortilla (peek)');
	});

	test('/ru/?tab=popular&dish=tortilla expanded has no violations', async ({ page }, testInfo) => {
		onlyOnMobile(testInfo);
		await gotoHydrated(page, '/ru/?tab=popular&dish=tortilla');
		await regionSheet(page).locator('button[aria-expanded]').click();
		await expectSheetExpanded(page, 'Тортилья');
		await expectNoViolations(page, '/ru/?tab=popular&dish=tortilla (expanded)');
	});

	const filtersOpen = [
		{ lang: 'en', query: '&f=vegetarian' },
		{ lang: 'ru', query: '&f=quick&f=summer' },
		{ lang: 'es', query: '' }
	] as const;
	for (const { lang, query } of filtersOpen) {
		const url = `/${lang}/?tab=popular${query}`;
		test(`${url} with the Filters sheet open has no violations`, async ({ page }, testInfo) => {
			onlyOnMobile(testInfo);
			await gotoHydrated(page, url);
			await openFiltersSheet(page, lang);
			await expectNoViolations(page, `${url} (Filters sheet)`);
		});
	}

	test('the Filters sheet over the dish sheet has no violations', async ({ page }, testInfo) => {
		onlyOnMobile(testInfo);
		await gotoHydrated(page, '/en/?tab=popular&dish=tortilla');
		await expectSheetPeek(page, 'Tortilla de patatas');
		await openFiltersSheetByKeyboard(page, 'en');
		await expectNoViolations(page, 'the Filters sheet over the dish sheet');
	});
});

// FE-4 PR 3 follow-up: axe can only say "incomplete" for text something else
// overlaps (bgOverlap), and then contrast goes unchecked. With the sheet
// hidden nothing may cover the mobile home (BottomSheet paints nothing at
// rest), so every text's contrast must be decided: no color-contrast nodes
// under `incomplete`. Not asserted with the sheet open: the scrim dims the
// page under it by design, so axe can't decide the text behind it (that is
// unavoidable); the open-sheet scans above still require zero violations.
// Map labels are excluded (coordinator, 2026-10-21): their semi-transparent
// --map-label-bg spans several cells, so axe reports them incomplete
// (elmPartiallyObscured) whatever the colours. Their contrast is checked
// deterministically instead, over every underlay, in
// src/lib/map/map-label-contrast.spec.ts.
const isMapLabel = (html: string) => html.includes('data-map-label');

async function expectContrastDecided(page: Page, what: string) {
	const Axe = await loadAxe();
	const { incomplete } = await new Axe({ page }).withTags(WCAG_AA_TAGS).analyze();
	const undecided = incomplete
		.filter((result) => result.id === 'color-contrast')
		.map((result) => ({ ...result, nodes: result.nodes.filter((n) => !isMapLabel(n.html)) }))
		.filter((result) => result.nodes.length > 0);
	expect(
		undecided,
		`got color-contrast left incomplete on ${what}:\n${summary(undecided)}`
	).toEqual([]);
}

test.describe('axe: contrast decided everywhere on the mobile home', () => {
	for (const url of ['/en/', '/en/?tab=popular', '/en/?tab=popular&f=vegetarian']) {
		test(`${url}: no color-contrast results left incomplete`, async ({ page }, testInfo) => {
			onlyOnMobile(testInfo);
			await gotoHydrated(page, url);
			// Popular may not render the region sheet at all; either way none paints.
			const painted = page.locator('[role="dialog"]').filter({ visible: true });
			await expect(painted, 'got a sheet painting over the mobile home').toHaveCount(0);
			await expectContrastDecided(page, url);
		});
	}
});

// FE-5 PR 3: desktop Popular, with the sticky filter sidebar and the card
// grid on screen (each scan first checks they are, so it covers them), at
// the narrowest and a wide desktop width: the default list, a filtered list
// (pressed chips, an enabled Clear all) and the empty state. The sidebar's
// "Clear all" is 40% opaque with nothing active; it is aria-disabled then,
// which WCAG 1.4.3 exempts from contrast, so every other contrast must be
// decided (nothing left incomplete). Then the same with a card hovered
// (lifted, with its shadow).
const DESKTOP_POPULAR_PROJECTS = ['chromium-desktop-860', DESKTOP_PROJECT];

function onlyInDesktopPopularProjects(testInfo: TestInfo) {
	test.skip(
		!DESKTOP_POPULAR_PROJECTS.includes(testInfo.project.name),
		`the desktop Popular scan runs in ${DESKTOP_POPULAR_PROJECTS.join(', ')}`
	);
}

test.describe('axe: WCAG 2.2 AA on desktop Popular', () => {
	const scans = [
		{ url: '/en/?tab=popular', empty: false },
		{ url: '/es/?tab=popular&f=vegetarian', empty: false },
		{ url: '/ru/?tab=popular&f=pork&f=winter&f=slow-cooked', empty: false },
		{ url: '/en/?tab=popular&f=desserts&f=summer', empty: true },
		{ url: '/ru/?tab=popular&f=seafood&f=easter', empty: true }
	];
	for (const { url, empty } of scans) {
		test(`${url}: sidebar and ${empty ? 'empty state' : 'cards'} have no violations`, async ({
			page
		}, testInfo) => {
			onlyInDesktopPopularProjects(testInfo);
			await gotoHydrated(page, url);
			await expect(filterSidebar(page)).toBeVisible();
			const results = empty ? noMatch(page) : dishCards(page).first();
			await expect(results).toBeVisible();
			await expectNoViolations(page, url);
			await expectContrastDecided(page, url);
		});
	}

	test('/en/?tab=popular with a card hovered has no violations', async ({ page }, testInfo) => {
		onlyInDesktopPopularProjects(testInfo);
		await gotoHydrated(page, '/en/?tab=popular');
		await expect(filterSidebar(page)).toBeVisible();
		await dishCards(page).nth(1).hover();
		await expectNoViolations(page, '/en/?tab=popular (card hovered)');
	});
});
