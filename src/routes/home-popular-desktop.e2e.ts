import { expect, test, type Locator, type Page, type TestInfo } from '../testutil/e2e-test';
import { LOCALES } from '../testutil/e2e';
import {
	boxOf,
	clampPx,
	computedStyle,
	expectPx,
	expectSameDocument,
	gotoHydrated,
	markDocument,
	onlyVisible,
	pathAndQuery,
	tokenValue
} from '../testutil/home-e2e';
import {
	DISH_KEYS,
	DISH_NAMES,
	FILTER_IDS,
	GROUP_IDS,
	GROUP_KEYS,
	POPULAR_COPY,
	SHEET_COPY,
	TEST_IDS,
	type PopularLocale
} from '../testutil/popular-copy';
import {
	cardHrefs,
	clearAllInSidebar,
	dishCard,
	dishCards,
	expectDishes,
	expectFiltersButton,
	filterSidebar,
	noMatch,
	popularPanel,
	pressedChips,
	quickChip,
	resultCount,
	sidebarChip,
	sidebarGroup,
	sidebarPressedIds,
	skipOnMobile
} from '../testutil/popular-e2e';
import { historyLength } from '../testutil/region-e2e';

// FE-5 PR 3, desktop Popular (≥ 860px) end to end: the sticky filter sidebar
// and the card grid (stage FE-5 -> Desktop Popular, Acceptance). Runs in
// every desktop project (860, 1280, 1440), in en, es and ru.
//
// Sources:
// - Desktop README -> Layout & screens -> Popular: "grid 220px minmax(0,1fr):
//   left sticky filter sidebar (all four groups always visible as wrapping
//   chips, "Clear all" at 40% opacity when nothing is active — no filters
//   sheet, no quick-chip row). Right: result count, then card grid
//   repeat(auto-fill, minmax(250px, 1fr)), gap 20px. ... Empty state: "No
//   dishes match these filters." + Clear all." Layout: "Content max-width
//   1440px, centred. Side padding and gaps are fluid: clamp(24px, 2.8vw,
//   40px) / clamp(28px, 3.4vw, 48px)."
// - Desktop prototype (Asadorov Desktop.dc.html) L137–176, which wins over
//   the README: the grid has "padding:28px <side> 64px; align-items:start";
//   the sidebar is "position:sticky; top:28px; flex column; gap:22px"; its
//   header row is "Filters" (Instrument Serif 27px) and "Clear all"
//   (12.5px/600, accent, opacity clearOp = active.length ? 1 : 0.4), on one
//   baseline, space-between; each group is an eyebrow (10.5px/700, .11em,
//   uppercase) over a wrapping chip row (gap 8px), stacked with gap 9px; the
//   chips are "padding:8px 14px ... font-size:13px; font-weight:600". The
//   right column is a flex column, gap 18px: the count (11.5px/700, .1em,
//   uppercase, padding-top 10px), then the grid. The empty state is
//   "padding:48px 0; text-align:center; gap:12px": noMatch in serif 24px,
//   Clear all 13px/600. A card's open() goes to view 'dish' (the Variations
//   page); there is no dish sheet and no visible "Popular" heading.
// - Desktop README -> State: "Every navigation scrolls the content area to
//   the top"; "Back ... returns to home with its previous state intact".
//
// Decisions pinned here (FE-5 PR 3):
// - Scroll model: the WINDOW scrolls on desktop, as on desktop Regional
//   (FE-4: "On desktop the page scrolls when the viewport is short"; the
//   top bar is not sticky). The prototype scrolls a container under a fixed
//   top bar instead; with the window as scroller the sidebar sticks 28px
//   below the viewport top once the top bar has scrolled away. The card
//   list is no scroll container on desktop (no overflow on any ancestor, or
//   sticky would stick to that ancestor instead).
// - The sidebar (data-testid="filter-sidebar") is a <section> landmark
//   named by its visible "Filters" heading (an <h3>, under the panel's <h2>),
//   with the same FilterGroups as the mobile sheet. Exactly one FilterGroups
//   is visible on desktop, and no filter bar.
// - Sidebar "Clear all" is a <button>. With nothing active it is 40% opaque
//   AND aria-disabled="true" (still focusable, a press does nothing):
//   WCAG 1.4.3 exempts inactive controls from contrast, which a 40% accent
//   text would otherwise fail, and a screen reader hears "dimmed" instead
//   of an action that does nothing. Not `disabled`: pressing it with
//   filters on would then drop focus to <body> the moment it disables.
// - Focus: a sidebar chip or the sidebar Clear all keeps focus where it is
//   (replace + reset: false, like every chip); the count's aria-live
//   announces the new total. The empty state's Clear all disappears with the
//   empty state, so it moves focus to the result count, as PR 1 did: it is
//   where the empty state was, it reads the restored count, and the next
//   Tab reaches the first card (home-popular.e2e.ts keeps that test).
// - Cards: ONE DishCard per dish, whose `href` the screen picks by layout:
//   the server renders /:lang/dishes/:dishKey (works without JavaScript on
//   both layouts, and gives crawlers a link to every Variations page); once
//   hydrated, mobile switches it to the dish sheet URL (?dish=, PR 2) and
//   desktop keeps the Variations page. Crossing 860px swaps it live. The
//   Variations href carries no filters (the page has none); Back restores
//   them from history.
// - Heading: the desktop prototype shows no "Popular" heading, so the
//   panel's <h2> stays visually hidden; "Filters" is the first visible one.

const SIDEBAR_WIDTH_PX = 220;
const GRID_PADDING_TOP_PX = 28;
const GRID_PADDING_BOTTOM_PX = 64;
const STICKY_TOP_PX = 28;
const CARD_MIN_WIDTH_PX = 250;
const CARD_GAP_PX = 20;
const COUNT_TO_GRID_GAP_PX = 18;
const SIDEBAR_GAP_PX = 22;
const GROUP_GAP_PX = 9;
const CHIP_GAP_PX = 8;
const CONTENT_MAX_WIDTH_PX = 1440;
const DIMMED_OPACITY = '0.4';
// A shorter window, so a sticky sidebar has room to stick at every width.
const SHORT_VIEWPORT_HEIGHT_PX = 600;
const LIFT = 'matrix(1, 0, 0, 1, 0, -2)';
const VEGETARIAN_DISHES = ['tortilla', 'gazpacho', 'arrozleche'];

// Every test here but the resize and no-JS ones starts on desktop, so a
// missing sidebar fails fast and by name instead of timing out a locator.
async function openPopular(page: Page, lang: PopularLocale, query = '') {
	await gotoHydrated(page, `/${lang}/?tab=popular${query}`);
	await expect(filterSidebar(page), 'want the desktop filter sidebar').toBeVisible();
}

async function expectUrl(page: Page, want: string) {
	await page.waitForURL((url) => url.pathname + url.search === want);
	expect(pathAndQuery(page)).toBe(want);
}

// The desktop README's fluid layout at this window: where the sidebar and
// the results column must start, and how wide the results column is.
type Geometry = { sidebarX: number; resultsX: number; resultsWidth: number; sidePad: number };

async function expectedGeometry(page: Page): Promise<Geometry> {
	const { vw, clientWidth } = await page.evaluate(() => ({
		vw: window.innerWidth,
		clientWidth: document.documentElement.clientWidth
	}));
	const sidePad = clampPx(24, 0.028 * vw, 40);
	const gap = clampPx(28, 0.034 * vw, 48);
	const container = Math.min(clientWidth, CONTENT_MAX_WIDTH_PX);
	const sidebarX = (clientWidth - container) / 2 + sidePad;
	const resultsWidth = container - 2 * sidePad - SIDEBAR_WIDTH_PX - gap;
	return { sidebarX, resultsX: sidebarX + SIDEBAR_WIDTH_PX + gap, resultsWidth, sidePad };
}

// repeat(auto-fill, minmax(250px, 1fr)) with a 20px gap in `width`.
function cardTracks(width: number): { count: number; track: number } {
	const count = Math.floor((width + CARD_GAP_PX) / (CARD_MIN_WIDTH_PX + CARD_GAP_PX));
	return { count, track: (width - CARD_GAP_PX * (count - 1)) / count };
}

// The sidebar's parent: the Popular grid (sidebar | results).
const popularGrid = (page: Page): Locator => filterSidebar(page).locator('xpath=..');

// The card grid: the cards' list.
const cardGrid = (page: Page): Locator => dishCards(page).first().locator('xpath=ancestor::ul[1]');

test.describe('Popular (desktop): the grid', () => {
	test.beforeEach(({ page }) => skipOnMobile(page));

	test(
		'grid 220px | minmax(0,1fr), fluid gap and side padding, 28px top, 64px bottom, in the 1440px cap',
		{ tag: '@layout' },
		async ({ page }) => {
			await openPopular(page, 'en');
			await expect(filterSidebar(page)).toBeVisible();
			const want = await expectedGeometry(page);
			const grid = await computedStyle(popularGrid(page), [
				'display',
				'align-items',
				'padding-top',
				'padding-bottom',
				'padding-left'
			]);
			expect(grid.display).toBe('grid');
			expect(grid['align-items'], 'sticky needs align-items: start').toBe('start');
			expect(grid['padding-top']).toBe(`${GRID_PADDING_TOP_PX}px`);
			expect(grid['padding-bottom']).toBe(`${GRID_PADDING_BOTTOM_PX}px`);
			expectPx(parseFloat(grid['padding-left']), want.sidePad, 'grid side padding');
			const sidebar = await boxOf(filterSidebar(page), 'the sidebar');
			expectPx(sidebar.width, SIDEBAR_WIDTH_PX, 'sidebar width');
			expectPx(sidebar.x, want.sidebarX, 'sidebar x');
			const count = await boxOf(resultCount(page), 'the result count');
			expectPx(count.x, want.resultsX, 'results column x');
			expectPx(count.y, sidebar.y, 'results column top (same row as the sidebar)');
		}
	);

	test('the grid has exactly two visible columns: the sidebar, then the results', async ({
		page
	}) => {
		await openPopular(page, 'en');
		const columns = await popularGrid(page).evaluate((grid) =>
			[...grid.children]
				.filter((child) => getComputedStyle(child).display !== 'none')
				.map((child) => ({
					sidebar: child.matches('[data-testid="filter-sidebar"]'),
					results:
						child.querySelector('[data-testid="result-count"]') !== null &&
						child.querySelector('[data-testid="dish-card"]') !== null
				}))
		);
		expect(columns).toEqual([
			{ sidebar: true, results: false },
			{ sidebar: false, results: true }
		]);
	});

	test(
		'result count, 18px, then the card grid: auto-fill minmax(250px, 1fr), gap 20px',
		{ tag: '@layout' },
		async ({ page }) => {
			await openPopular(page, 'en');
			const want = await expectedGeometry(page);
			const grid = await computedStyle(cardGrid(page), ['display', 'column-gap', 'row-gap']);
			expect(grid.display).toBe('grid');
			expect(grid['column-gap']).toBe(`${CARD_GAP_PX}px`);
			expect(grid['row-gap']).toBe(`${CARD_GAP_PX}px`);
			const gridBox = await boxOf(cardGrid(page), 'the card grid');
			const count = await boxOf(resultCount(page), 'the result count');
			expectPx(gridBox.y - (count.y + count.height), COUNT_TO_GRID_GAP_PX, 'count → grid gap');
			expectPx(gridBox.width, want.resultsWidth, 'card grid width');
			await expectCardTracks(page, want);
		}
	);

	test('the result count: 11.5px/700, .1em, uppercase, --ink-3, padding-top 10px', async ({
		page
	}) => {
		await openPopular(page, 'en');
		await expect(resultCount(page)).toHaveText(POPULAR_COPY.en.dishes[7]);
		const got = await computedStyle(resultCount(page), [
			'font-size',
			'font-weight',
			'letter-spacing',
			'text-transform',
			'color',
			'padding-top'
		]);
		expect(got['font-size']).toBe('11.5px');
		expect(got['font-weight']).toBe('700');
		expectPx(parseFloat(got['letter-spacing']), 1.15, 'count letter-spacing');
		expect(got['text-transform']).toBe('uppercase');
		expect(got.color).toBe(await tokenValue(page, 'color', 'var(--ink-3)'));
		expect(got['padding-top']).toBe('10px');
	});

	for (const lang of LOCALES) {
		test(`${lang}: every dish as a card, in dish order, with its name`, async ({ page }) => {
			await openPopular(page, lang);
			await expectDishes(page, DISH_KEYS, `${lang} unfiltered`);
			const names = DISH_KEYS.map((key) => DISH_NAMES[lang][key]);
			await expect(dishCards(page).locator('h3')).toHaveText(names);
			await expect(resultCount(page)).toHaveText(POPULAR_COPY[lang].dishes[7]);
		});
	}
});

async function expectCardTracks(page: Page, want: Geometry) {
	const { count, track } = cardTracks(want.resultsWidth);
	const boxes = await dishCards(page).evaluateAll((cards) =>
		cards.map((c) => {
			const r = c.getBoundingClientRect();
			return { x: r.x, y: r.y, width: r.width, bottom: r.bottom };
		})
	);
	for (const [i, box] of boxes.entries()) {
		const column = i % count;
		expectPx(box.width, track, `card ${i} width`);
		expectPx(box.x, want.resultsX + column * (track + CARD_GAP_PX), `card ${i} x`);
	}
	if (boxes.length > count) {
		expectPx(boxes[count].y - boxes[0].bottom, CARD_GAP_PX, 'row gap');
	}
}

test.describe('Popular (desktop): the sticky sidebar', () => {
	test.beforeEach(({ page }) => skipOnMobile(page));

	test('position: sticky, top 28px', async ({ page }) => {
		await openPopular(page, 'en');
		const got = await computedStyle(filterSidebar(page), ['position', 'top']);
		expect(got).toEqual({ position: 'sticky', top: `${STICKY_TOP_PX}px` });
	});

	test(
		'the window scrolls the grid; the sidebar stays 28px under the viewport top',
		{ tag: ['@layout', '@cross-browser'] },
		async ({ page }) => {
			const width = page.viewportSize()!.width;
			await page.setViewportSize({ width, height: SHORT_VIEWPORT_HEIGHT_PX });
			await openPopular(page, 'en');
			const sidebarBefore = await boxOf(filterSidebar(page), 'the sidebar');
			const cardBefore = await boxOf(dishCards(page).first(), 'the first card');
			const scrolled = await page.evaluate(() => {
				window.scrollTo(0, document.scrollingElement!.scrollHeight);
				return window.scrollY;
			});
			expect(
				scrolled,
				'want the window scrolled past the sidebar start (window scroll model)'
			).toBeGreaterThan(sidebarBefore.y - STICKY_TOP_PX);
			await expect
				.poll(async () => (await boxOf(filterSidebar(page), 'the sidebar')).y, {
					message: 'want the sidebar stuck 28px under the viewport top'
				})
				.toBeCloseTo(STICKY_TOP_PX, 0);
			const cardAfter = await boxOf(dishCards(page).first(), 'the first card');
			expectPx(cardAfter.y, cardBefore.y - scrolled, 'first card after the window scroll');
		}
	);

	test('no scroll container around the cards on desktop (the window is the scroller)', async ({
		page
	}) => {
		await openPopular(page, 'en');
		const scroller = await dishCards(page)
			.first()
			.evaluate((card) => {
				for (let el = card.parentElement; el && el !== document.body; el = el.parentElement) {
					const s = getComputedStyle(el);
					if (/(auto|scroll|hidden|clip)/.test(s.overflowY)) return el.outerHTML.slice(0, 120);
				}
				return null;
			});
		expect(scroller, 'got an overflow ancestor; sticky would stick to it').toBeNull();
	});

	test(
		'ru with every chip: the stuck sidebar fits in the window, all groups visible',
		{ tag: '@layout' },
		async ({ page }) => {
			const query = FILTER_IDS.map((id) => `&f=${id}`).join('');
			await openPopular(page, 'ru', query);
			const sidebar = await boxOf(filterSidebar(page), 'the sidebar');
			const height = page.viewportSize()!.height;
			expect(
				STICKY_TOP_PX + sidebar.height,
				'got a stuck sidebar taller than the window'
			).toBeLessThanOrEqual(height);
			for (const key of GROUP_KEYS) await expect(sidebarGroup(page, 'ru', key)).toBeVisible();
		}
	);

	// Review (WCAG 2.4.7): in a window shorter than the stuck sidebar, the
	// sidebar scrolls itself (capped at the window like StickyPanel), so Tab
	// never focuses a chip below the viewport.
	test(
		'ru with every chip in a short window: Tab reveals the last chip',
		{ tag: '@cross-browser' },
		async ({ page }) => {
			await page.setViewportSize(SHORT_WINDOW);
			await openPopular(page, 'ru', FILTER_IDS.map((id) => `&f=${id}`).join(''));
			const last = sidebarChip(page, 'ru', 'all-year');
			await clearAllInSidebar(page, 'ru').focus();
			for (let i = 0; i < FILTER_IDS.length && !(await isFocused(last)); i++) {
				await page.keyboard.press('Tab');
			}
			await expect(last).toBeFocused();
			const chip = await boxOf(last, 'the last chip');
			const sidebar = await filterSidebar(page).evaluate((el) =>
				el.getBoundingClientRect().toJSON()
			);
			expect(chip.y, 'chip top in the window').toBeGreaterThanOrEqual(0);
			expect(chip.y + chip.height, 'chip bottom in the window').toBeLessThanOrEqual(
				SHORT_WINDOW.height
			);
			expect(chip.y, 'chip top in the sidebar').toBeGreaterThanOrEqual(sidebar.top);
			expect(chip.y + chip.height, 'chip bottom in the sidebar').toBeLessThanOrEqual(
				sidebar.bottom
			);
		}
	);
});

const SHORT_WINDOW = { width: 960, height: 520 };

const isFocused = (locator: Locator): Promise<boolean> =>
	locator.evaluate((el) => el === document.activeElement);

test.describe('Popular (desktop): sidebar content', () => {
	test.beforeEach(({ page }) => skipOnMobile(page));

	for (const lang of LOCALES) {
		const copy = SHEET_COPY[lang];
		test(`${lang}: a region "${POPULAR_COPY[lang].filters}" with its <h3>, four groups, twelve chips`, async ({
			page
		}) => {
			await openPopular(page, lang);
			const name = POPULAR_COPY[lang].filters;
			const region = page.getByRole('region', { name, exact: true });
			await expect(region).toHaveAttribute('data-testid', TEST_IDS.filterSidebar);
			await expect(region.getByRole('heading', { level: 3, name, exact: true })).toBeVisible();
			for (const key of GROUP_KEYS) {
				const chips = sidebarGroup(page, lang, key).getByRole('button');
				await expect(chips).toHaveText(GROUP_IDS[key].map((id) => copy.labels[id]));
			}
			expect(await sidebarPressedIds(page, lang, FILTER_IDS)).toEqual([]);
		});
	}

	test('the URL presses the chips: ?f=pork&f=winter', async ({ page }) => {
		await openPopular(page, 'en', '&f=pork&f=winter');
		expect(await sidebarPressedIds(page, 'en', FILTER_IDS)).toEqual(['pork', 'winter']);
		await expectDishes(page, ['cocido'], 'pork AND winter');
	});

	test('no quick-chip row, no Filters button, one visible FilterGroups (the sidebar)', async ({
		page
	}) => {
		await openPopular(page, 'en', '&f=vegetarian');
		await expect(onlyVisible(page.getByTestId(TEST_IDS.filterBar))).toHaveCount(0);
		await expect(onlyVisible(page.getByRole('dialog'))).toHaveCount(0);
		const groups = onlyVisible(page.getByTestId(TEST_IDS.filterGroups));
		await expect(groups).toHaveCount(1);
		await expect(filterSidebar(page).getByTestId(TEST_IDS.filterGroups)).toBeVisible();
	});

	test(
		'ru: every chip label whole, wrapping inside the 220px column',
		{ tag: '@cross-browser' },
		async ({ page }) => {
			await openPopular(page, 'ru', '&f=easter');
			const report = await filterSidebar(page).evaluate((sidebar) => ({
				clipped: [...sidebar.querySelectorAll('button')]
					.filter((b) => b.scrollWidth > b.clientWidth + 1)
					.map((b) => b.textContent?.trim()),
				wider: sidebar.scrollWidth - sidebar.clientWidth
			}));
			expect(report.clipped, 'got clipped chip labels').toEqual([]);
			expect(report.wider, 'got chips wider than the sidebar').toBeLessThanOrEqual(0);
		}
	);
});

test.describe('Popular (desktop): sidebar style (prototype)', () => {
	test.beforeEach(({ page }) => skipOnMobile(page));

	test('header row: "Filters" 27px Instrument Serif and "Clear all" 12.5px/600 accent, baseline, space-between', async ({
		page
	}) => {
		await openPopular(page, 'en', '&f=quick');
		const heading = filterSidebar(page).getByRole('heading', { level: 3 });
		const title = await computedStyle(heading, ['font-size', 'font-family', 'margin-top']);
		expect(title['font-size']).toBe('27px');
		expect(title['font-family']).toBe(await tokenValue(page, 'font-family', 'var(--font-display)'));
		expect(title['margin-top']).toBe('0px');
		const clear = await computedStyle(clearAllInSidebar(page, 'en'), [
			'font-size',
			'font-weight',
			'color'
		]);
		expect(clear['font-size']).toBe('12.5px');
		expect(clear['font-weight']).toBe('600');
		expect(clear.color).toBe(await tokenValue(page, 'color', 'var(--accent-text)'));
		const headingBox = await boxOf(heading, 'the heading');
		const clearBox = await boxOf(clearAllInSidebar(page, 'en'), 'Clear all');
		const sidebar = await boxOf(filterSidebar(page), 'the sidebar');
		expectPx(headingBox.x, sidebar.x, 'heading left');
		expectPx(clearBox.x + clearBox.width, sidebar.x + sidebar.width, 'Clear all right edge');
	});

	test('stack gap 22px; groups: eyebrow 10.5px/700 .11em, 9px above a wrapping row, chips 8px apart, 13px/600, padding 8px 14px', async ({
		page
	}) => {
		await openPopular(page, 'en');
		const stack = await computedStyle(filterSidebar(page), [
			'display',
			'flex-direction',
			'row-gap'
		]);
		expect(stack).toEqual({ display: 'flex', 'flex-direction': 'column', 'row-gap': '22px' });
		const groups = await sidebarGroupBoxes(page);
		for (let i = 1; i < groups.length; i++) {
			expectPx(groups[i].top - groups[i - 1].bottom, SIDEBAR_GAP_PX, `gap above group ${i}`);
		}
		const diet = sidebarGroup(page, 'en', 'diet');
		const eyebrow = diet.getByText(SHEET_COPY.en.groups.diet, { exact: true });
		const eyebrowStyle = await computedStyle(eyebrow, [
			'font-size',
			'font-weight',
			'letter-spacing'
		]);
		expect(eyebrowStyle['font-size']).toBe('10.5px');
		expect(eyebrowStyle['font-weight']).toBe('700');
		expectPx(parseFloat(eyebrowStyle['letter-spacing']), 10.5 * 0.11, 'eyebrow letter-spacing');
		await expectChipMetrics(page, eyebrow);
	});
});

async function sidebarGroupBoxes(page: Page) {
	const boxes = [];
	for (const key of GROUP_KEYS) {
		const box = await boxOf(sidebarGroup(page, 'en', key), `group ${key}`);
		boxes.push({ top: box.y, bottom: box.y + box.height });
	}
	return boxes;
}

async function expectChipMetrics(page: Page, eyebrow: Locator) {
	const vegetarian = sidebarChip(page, 'en', 'vegetarian');
	const seafood = sidebarChip(page, 'en', 'seafood');
	const chip = await computedStyle(vegetarian, [
		'font-size',
		'font-weight',
		'padding-left',
		'padding-top'
	]);
	expect(chip).toEqual({
		'font-size': '13px',
		'font-weight': '600',
		'padding-left': '14px',
		'padding-top': '8px'
	});
	const eyebrowBox = await boxOf(eyebrow, 'the Diet eyebrow');
	const first = await boxOf(vegetarian, 'Vegetarian');
	const second = await boxOf(seafood, 'Seafood');
	expectPx(first.y - (eyebrowBox.y + eyebrowBox.height), GROUP_GAP_PX, 'eyebrow → chips gap');
	expectPx(second.x - (first.x + first.width), CHIP_GAP_PX, 'chip gap');
}

test.describe('Popular (desktop): sidebar chips drive the URL', () => {
	test.beforeEach(({ page }) => skipOnMobile(page));

	for (const lang of LOCALES) {
		// One locale per engine: focus and history don't change with the language.
		const tag = lang === 'en' ? ['@cross-browser'] : [];
		test(
			`${lang}: Vegetarian writes f=vegetarian, replaces the entry, keeps focus, no reload`,
			{ tag },
			async ({ page }) => {
				await openPopular(page, lang);
				await markDocument(page);
				const before = await historyLength(page);
				await sidebarChip(page, lang, 'vegetarian').click();
				await expectUrl(page, `/${lang}/?tab=popular&f=vegetarian`);
				await expectDishes(page, VEGETARIAN_DISHES, 'vegetarian');
				await expect(resultCount(page)).toHaveText(POPULAR_COPY[lang].dishes[3]);
				await expect(sidebarChip(page, lang, 'vegetarian')).toHaveAttribute('aria-pressed', 'true');
				await expect(sidebarChip(page, lang, 'vegetarian')).toBeFocused();
				expect(await historyLength(page), 'want the entry replaced').toBe(before);
				await expectSameDocument(page, 'after a sidebar chip');
			}
		);
	}

	test('OR within a group, AND across groups: Tapas + Mains, then Quick', async ({ page }) => {
		await openPopular(page, 'en');
		await sidebarChip(page, 'en', 'mains').click();
		await sidebarChip(page, 'en', 'tapas').click();
		await expectUrl(page, '/en/?tab=popular&f=tapas&f=mains');
		await expectDishes(
			page,
			['tortilla', 'paella', 'cocido', 'gazpacho', 'croquetas'],
			'tapas OR mains'
		);
		await sidebarChip(page, 'en', 'quick').click();
		await expectUrl(page, '/en/?tab=popular&f=tapas&f=mains&f=quick');
		await expectDishes(page, ['tortilla', 'gazpacho', 'croquetas'], '(tapas OR mains) AND quick');
	});

	test('a pressed chip toggles off again', async ({ page }) => {
		await openPopular(page, 'en', '&f=seafood');
		await sidebarChip(page, 'en', 'seafood').click();
		await expectUrl(page, '/en/?tab=popular');
		await expectDishes(page, DISH_KEYS, 'seafood off');
	});

	test('keyboard: Space on a focused chip toggles it', async ({ page }) => {
		await openPopular(page, 'en');
		await sidebarChip(page, 'en', 'winter').focus();
		await page.keyboard.press('Space');
		await expectUrl(page, '/en/?tab=popular&f=winter');
		await expect(sidebarChip(page, 'en', 'winter')).toBeFocused();
	});
});

test.describe('Popular (desktop): the sidebar "Clear all"', () => {
	test.beforeEach(({ page }) => skipOnMobile(page));

	for (const lang of LOCALES) {
		test(`${lang}: nothing active → 40% opacity and aria-disabled="true"`, async ({ page }) => {
			await openPopular(page, lang);
			const clear = clearAllInSidebar(page, lang);
			await expect(clear).toHaveAttribute('aria-disabled', 'true');
			expect((await computedStyle(clear, ['opacity'])).opacity).toBe(DIMMED_OPACITY);
		});

		test(`${lang}: a filter on → full opacity, enabled`, async ({ page }) => {
			await openPopular(page, lang, '&f=summer');
			const clear = clearAllInSidebar(page, lang);
			await expect(clear).not.toHaveAttribute('aria-disabled', 'true');
			await expect(clear).toBeEnabled();
			expect((await computedStyle(clear, ['opacity'])).opacity).toBe('1');
		});
	}

	test('pressed with filters: empties them, replaces the entry, focus stays on it, dims it', async ({
		page
	}) => {
		await openPopular(page, 'es', '&f=vegetarian&f=quick');
		await markDocument(page);
		const before = await historyLength(page);
		await clearAllInSidebar(page, 'es').click();
		await expectUrl(page, '/es/?tab=popular');
		await expectDishes(page, DISH_KEYS, 'after Clear all');
		expect(await sidebarPressedIds(page, 'es', FILTER_IDS)).toEqual([]);
		expect(await historyLength(page), 'want the entry replaced').toBe(before);
		await expectSameDocument(page, 'after the sidebar Clear all');
		await expect(clearAllInSidebar(page, 'es')).toBeFocused();
		await expect(clearAllInSidebar(page, 'es')).toHaveAttribute('aria-disabled', 'true');
	});

	test('pressed with nothing active: no navigation, no history entry', async ({ page }) => {
		await openPopular(page, 'en', '&dish=tortilla');
		const before = await historyLength(page);
		// force: Playwright treats aria-disabled="true" as not actionable.
		await clearAllInSidebar(page, 'en').click({ force: true });
		await clearAllInSidebar(page, 'en').press('Enter');
		expect(pathAndQuery(page)).toBe('/en/?tab=popular&dish=tortilla');
		expect(await historyLength(page)).toBe(before);
		await expect(clearAllInSidebar(page, 'en')).toBeFocused();
	});
});

test.describe('Popular (desktop): nothing matches', () => {
	test.beforeEach(({ page }) => skipOnMobile(page));

	for (const lang of LOCALES) {
		const copy = POPULAR_COPY[lang];
		test(`${lang}: "${copy.noMatch}", the count "${copy.dishes[0]}", and "${copy.clearAll}" restores the list`, async ({
			page
		}) => {
			await openPopular(page, lang, '&f=desserts&f=summer');
			await expect(dishCards(page)).toHaveCount(0);
			await expect(noMatch(page)).toBeVisible();
			await expect(noMatch(page)).toContainText(copy.noMatch);
			await expect(resultCount(page)).toBeVisible();
			await expect(resultCount(page)).toHaveText(copy.dishes[0]);
			await expect(clearAllInSidebar(page, lang)).not.toHaveAttribute('aria-disabled', 'true');
			await noMatch(page).getByRole('link', { name: copy.clearAll, exact: true }).click();
			await expectUrl(page, `/${lang}/?tab=popular`);
			await expectDishes(page, DISH_KEYS, 'after Clear all');
			await expect(noMatch(page)).toHaveCount(0);
			await expect(resultCount(page)).toBeFocused();
		});
	}

	test('empty state: centred, padding 48px 0, gap 12px, noMatch serif 24px, Clear all 13px/600', async ({
		page
	}) => {
		await openPopular(page, 'en', '&f=desserts&f=summer');
		const box = await computedStyle(noMatch(page), ['padding-top', 'padding-bottom', 'row-gap']);
		expect(box).toEqual({ 'padding-top': '48px', 'padding-bottom': '48px', 'row-gap': '12px' });
		const text = noMatch(page).getByText(POPULAR_COPY.en.noMatch, { exact: true });
		const textStyle = await computedStyle(text, ['font-size', 'font-family', 'text-align']);
		expect(textStyle['font-size']).toBe('24px');
		expect(textStyle['font-family']).toBe(
			await tokenValue(page, 'font-family', 'var(--font-display)')
		);
		expect(textStyle['text-align']).toBe('center');
		const link = noMatch(page).getByRole('link', { name: POPULAR_COPY.en.clearAll, exact: true });
		const linkStyle = await computedStyle(link, ['font-size', 'font-weight']);
		expect(linkStyle).toEqual({ 'font-size': '13px', 'font-weight': '600' });
	});
});

test.describe('Popular (desktop): cards open the Variations page', () => {
	test.beforeEach(({ page }) => skipOnMobile(page));

	for (const lang of LOCALES) {
		test(`${lang}: every card links to /${lang}/dishes/:dishKey, without the filters`, async ({
			page
		}) => {
			await openPopular(page, lang, '&f=vegetarian');
			const want = VEGETARIAN_DISHES.map((key) => `/${lang}/dishes/${key}`);
			await expect.poll(() => cardHrefs(page)).toEqual(want);
		});
	}

	test(
		'a click goes straight to the Variations page (client-side), no sheet; Back restores the filters',
		{ tag: '@cross-browser' },
		async ({ page }) => {
			await openPopular(page, 'en', '&f=vegetarian');
			await markDocument(page);
			await dishCard(page, 'tortilla').click();
			await expectUrl(page, '/en/dishes/tortilla');
			await expect(
				page.getByRole('heading', { level: 1, name: DISH_NAMES.en.tortilla })
			).toBeVisible();
			await expectSameDocument(page, 'after a card click');
			await page.goBack();
			await expectUrl(page, '/en/?tab=popular&f=vegetarian');
			await expectDishes(page, VEGETARIAN_DISHES, 'restored list');
			await expect(sidebarChip(page, 'en', 'vegetarian')).toHaveAttribute('aria-pressed', 'true');
			await expect(onlyVisible(page.getByRole('dialog'))).toHaveCount(0);
		}
	);

	test('Enter on a focused card opens the Variations page', async ({ page }) => {
		await openPopular(page, 'ru');
		await dishCard(page, 'paella').focus();
		await page.keyboard.press('Enter');
		await expectUrl(page, '/ru/dishes/paella');
	});

	test('hover lifts the card 2px with --shadow-card-hover', async ({ page }) => {
		await openPopular(page, 'en');
		const card = dishCard(page, 'gazpacho');
		await card.hover();
		const shadow = await tokenValue(page, 'box-shadow', 'var(--shadow-card-hover)');
		await expect
			.poll(async () => computedStyle(card, ['transform', 'box-shadow']))
			.toEqual({ transform: LIFT, 'box-shadow': shadow });
	});
});

test.describe('Popular (desktop): headings', () => {
	test.beforeEach(({ page }) => skipOnMobile(page));

	for (const lang of LOCALES) {
		test(`${lang}: the panel <h2> stays visually hidden; "Filters" is the first visible heading`, async ({
			page
		}) => {
			await openPopular(page, lang);
			const h2 = popularPanel(page).getByRole('heading', {
				level: 2,
				name: POPULAR_COPY[lang].popular,
				exact: true
			});
			await expect(h2).toHaveCount(1);
			const box = await boxOf(h2, 'the Popular <h2>');
			expect(box.width * box.height, 'want the <h2> visually hidden').toBeLessThanOrEqual(1);
			const visible = await page.evaluate(() =>
				[...document.querySelectorAll('h1, h2, h3, h4, h5, h6')]
					.filter((h) => h.getBoundingClientRect().width > 1 && h.checkVisibility())
					.map((h) => h.textContent?.trim())
			);
			expect(visible[0]).toBe(POPULAR_COPY[lang].filters);
		});
	}
});

// Crossing 860px keeps the URL's filters: the sidebar and the mobile bar
// read the same `f` params, and the card href follows the layout.
test.describe('Popular: resizing across 860px with filters', () => {
	const PROJECT = 'chromium-desktop-1280';
	const MOBILE = { width: 390, height: 844 };
	const DESKTOP = { width: 1280, height: 800 };

	const onlyInResizeProject = (testInfo: TestInfo) =>
		test.skip(testInfo.project.name !== PROJECT, `resize checks run in ${PROJECT} only`);

	test('desktop → mobile → desktop: filters kept both ways, card hrefs follow the layout', async ({
		page
	}, testInfo) => {
		onlyInResizeProject(testInfo);
		await openPopular(page, 'en', '&f=vegetarian');
		await sidebarChip(page, 'en', 'quick').click();
		await expectUrl(page, '/en/?tab=popular&f=vegetarian&f=quick');
		await expect
			.poll(() => cardHrefs(page))
			.toEqual(['/en/dishes/tortilla', '/en/dishes/gazpacho']);
		await page.setViewportSize(MOBILE);
		await expectFiltersButton(page, 'en', 2);
		expect(await pressedChips(page, 'en', ['vegetarian', 'quick'])).toEqual([
			'vegetarian',
			'quick'
		]);
		const sheetHref = (key: string) => `/en/?tab=popular&f=vegetarian&f=quick&dish=${key}`;
		await expect
			.poll(() => cardHrefs(page))
			.toEqual([sheetHref('tortilla'), sheetHref('gazpacho')]);
		await quickChip(page, 'en', 'summer').click();
		await expectUrl(page, '/en/?tab=popular&f=vegetarian&f=quick&f=summer');
		await page.setViewportSize(DESKTOP);
		await expect(filterSidebar(page)).toBeVisible();
		expect(await sidebarPressedIds(page, 'en', FILTER_IDS)).toEqual([
			'vegetarian',
			'quick',
			'summer'
		]);
		await expect.poll(() => cardHrefs(page)).toEqual(['/en/dishes/gazpacho']);
		await expect(onlyVisible(page.getByRole('dialog'))).toHaveCount(0);
	});
});

// The server renders the Variations href, so a card works before (or
// without) hydration on both layouts.
test.describe('Popular without JavaScript: cards lead to the Variations page', () => {
	test.use({ javaScriptEnabled: false });

	test('a card click lands on /:lang/dishes/:dishKey', async ({ page }) => {
		await page.goto('/es/?tab=popular&f=vegetarian');
		await dishCard(page, 'gazpacho').click();
		await expectUrl(page, '/es/dishes/gazpacho');
		await expect(
			page.getByRole('heading', { level: 1, name: DISH_NAMES.es.gazpacho })
		).toBeVisible();
	});
});
