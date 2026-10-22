import { expect, test, type Locator, type Page, type TestInfo } from '../testutil/e2e-test';
import { expectAnimationsSettled } from '../testutil/animations-e2e';
import { expectNoViolations } from '../testutil/axe-e2e';
import { expectPillWithHref, clickPill } from '../testutil/desktop-pages-e2e';
import {
	desktopSearchInput,
	dropdownBox,
	dropdownGroup,
	dropdownOption,
	expectDropdownClosed,
	fieldBox,
	focusDesktopSearch,
	searchDropdown,
	typeInDesktopSearch
} from '../testutil/desktop-search-e2e';
import { getRaw } from '../testutil/e2e';
import {
	boxOf,
	clampPx,
	computedStyle,
	expectPx,
	gotoHydrated,
	HOME_COPY,
	onlyVisible,
	pathAndQuery,
	right
} from '../testutil/home-e2e';
import { expectUrl, HOME_WITH_FILTERS } from '../testutil/home-flow-e2e';
import { startTags } from '../testutil/html';
import { isOnTop, languageButton } from '../testutil/language-menu-e2e';
import { DISH_NAMES } from '../testutil/popular-copy';
import { skipOnMobile } from '../testutil/popular-e2e';
import { BETANZOS } from '../testutil/recipe-copy';
import { historyLength, regionPanel } from '../testutil/region-e2e';
import {
	DESKTOP_PLACEHOLDER,
	nothingFor,
	SEARCH_COPY,
	SEARCH_LOCALES,
	type SearchLocale
} from '../testutil/search-copy';
import {
	DISHES,
	expectSelectedTab,
	openSearch,
	recordUrls,
	REGIONS,
	VARIATIONS
} from '../testutil/search-e2e';
import { installStorageSpy, recordedWrites } from '../testutil/storage-spy';

// FE-7 PR 4, the desktop inline search end to end (≥ 860px; every test
// skips at mobile widths, where the overlay of search-overlay.e2e.ts applies).
//
// Sources:
// - Desktop README -> Top bar (L51) and "Search on desktop" (L65): the
//   inline field (44px, clamp(220px, 25vw, 360px)); the dropdown (min(440px,
//   100vw − 48px), max-height 520px, radius 18px, shadow 0 18px 44px
//   rgba(43,30,22,.2)); Escape or an outside click closes; "a variation
//   result opens its recipe directly (mobile opens the variations page)".
// - Desktop prototype (Asadorov Desktop.dc.html): the top bar (L18–74) sits
//   above every view (home, dish, recipe), so the field is on the Variations
//   and Recipe pages too; the panel is "top:54px;right:0" under the field
//   (L838); focus opens it, and an empty query shows the TRY chips (L29,
//   L834, L839); Escape and the outside layer close it keeping the query
//   (L825, L835); a pick goes to its view with `from: 'home'` and the tab
//   unchanged (L807–809), so the Variations pill reads the home tab (L860)
//   and the Recipe pill Popular or the recipe's region (L869).
// - Stage FE-7 -> Acceptance: "Desktop: typing in the top-bar field opens the
//   dropdown. A variation result opens the recipe ... Escape and an outside
//   click close the dropdown"; "In /ru/, typing "paella" shows the paella
//   dish. Typing "андалусия" shows the region"; no storage, no cookie.
// - Stage FE-7 -> Small decisions, PR 2 note: with the mobile overlay open,
//   widening past 860px sends focus to the desktop search field.
//
// Decisions pinned here (FE-7 PR 4):
// - Desktop selection is one plain push, with no Popular replace (that is
//   the mobile flow): the back pill returns to the page search was used
//   from (FE-6 recordOrigin), and Back does too.
// - The pill's label always names the page its href goes to (coordinator,
//   FE-7 PR 4): from another dish's Variations page, that dish's name (as
//   a Variations origin always reads); from another region, the origin
//   region's name, not the recipe's.
// - The field is in the server HTML as a real <input role="combobox">, but
//   `disabled` until hydrated: search is client-side, so without JavaScript
//   a typeable field would mislead. The box is there, so hydration shifts
//   nothing. It is the page's only combobox in the server HTML.
// - The field's content height is 44px plus a 1.5px border (content-box, as
//   the prototype and the desktop language button beside it): the field is
//   exactly as tall as the language button.
// - Escape keeps focus in the field (APG combobox); the query stays.
// - Tab out of the search closes the dropdown.

const DROPDOWN = { belowFieldTop: 54, width: 440, sideMargin: 48, maxHeight: 520 };
const FIELD_WIDTH = { min: 220, vw: 0.25, max: 360 };
const DROPDOWN_RADIUS = '18px';
const DROPDOWN_SHADOW = 'rgba(43, 30, 22, 0.2) 0px 18px 44px 0px';
// A query that matches more than 520px of rows (6 per group, 3 groups).
const MANY_RESULTS_QUERY = 'a';
const MOBILE_WIDTH = 600;
const DESKTOP_WIDTH = 1280;
const HTML_PROJECT = 'chromium-desktop-1280';
// The field's "×", the dropdown (a scroll container), then out.
const MAX_TABS_OUT_OF_SEARCH = 3;

// Every page with the desktop top bar (prototype: the bar is above every view).
const TOP_BAR_PAGES = [
	'/en/',
	'/en/?tab=popular',
	'/en/dishes/tortilla',
	'/en/dishes/tortilla/gal'
];

test.beforeEach(({ page }) => skipOnMobile(page, 'the desktop inline search (≥ 860px)'));

function onlyInHtmlProject(testInfo: TestInfo) {
	test.skip(testInfo.project.name !== HTML_PROJECT, `HTML checks run in ${HTML_PROJECT} only`);
}

const innerWidth = (page: Page) => page.evaluate(() => window.innerWidth);

async function pick(page: Page, lang: SearchLocale, group: 0 | 1 | 2, title: string) {
	await dropdownOption(dropdownGroup(page, lang, group), title).click();
}

async function tabTo(page: Page, target: Locator, maxPresses: number) {
	for (let i = 0; i < maxPresses; i++) {
		if (await target.evaluate((el) => el === document.activeElement)) return;
		await page.keyboard.press('Tab');
	}
	await expect(target, `want Tab to reach it within ${maxPresses} presses`).toBeFocused();
}

async function expectSearchReset(page: Page, lang: SearchLocale) {
	await expectDropdownClosed(page, lang);
	await expect(desktopSearchInput(page, lang)).toHaveValue('');
}

test.describe('desktop search: the field', () => {
	for (const url of TOP_BAR_PAGES) {
		test(`${url}: the top bar holds the field, left of the language button`, async ({ page }) => {
			await gotoHydrated(page, url);
			await expect(desktopSearchInput(page, 'en')).toBeVisible();
			await expect(desktopSearchInput(page, 'en')).toBeEnabled();
			const field = await fieldBox(page);
			const language = await boxOf(languageButton(page, 'en'), 'the language button');
			expect(right(field), 'want the field before the language button').toBeLessThan(language.x);
		});
	}

	for (const url of ['/en/', '/en/dishes/tortilla/gal']) {
		test(
			`${url}: as tall as the language button, clamp(220px, 25vw, 360px) wide`,
			{ tag: ['@layout'] },
			async ({ page }) => {
				await gotoHydrated(page, url);
				const field = await fieldBox(page);
				const language = await boxOf(languageButton(page, 'en'), 'the language button');
				expectPx(field.height, language.height, 'field height');
				const want = clampPx(
					FIELD_WIDTH.min,
					FIELD_WIDTH.vw * (await innerWidth(page)),
					FIELD_WIDTH.max
				);
				expectPx(field.width, want, 'field width');
			}
		);
	}

	for (const lang of SEARCH_LOCALES) {
		test(`${lang}: named "${SEARCH_COPY[lang].dialog}", placeholder "${DESKTOP_PLACEHOLDER[lang]}"`, async ({
			page
		}) => {
			await gotoHydrated(page, `/${lang}/`);
			const input = desktopSearchInput(page, lang);
			await expect(input).toHaveAttribute('placeholder', DESKTOP_PLACEHOLDER[lang]);
			await expect(input).toHaveAttribute('aria-autocomplete', 'list');
			await expect(input).toHaveAttribute('aria-expanded', 'false');
		});
	}
});

test.describe('desktop search: the dropdown', () => {
	test('typing in the field opens the dropdown with grouped results', async ({ page }) => {
		await gotoHydrated(page, '/en/');
		await expect(searchDropdown(page)).toBeHidden();
		await typeInDesktopSearch(page, 'en', 'tortilla');
		await expect(
			dropdownOption(dropdownGroup(page, 'en', DISHES), 'Tortilla de patatas')
		).toBeVisible();
		await expect(desktopSearchInput(page, 'en')).toHaveAttribute('aria-expanded', 'true');
	});

	test('focus with an empty query shows the TRY suggestions', async ({ page }) => {
		await gotoHydrated(page, '/en/');
		await focusDesktopSearch(page, 'en');
		const copy = SEARCH_COPY.en;
		await expect(searchDropdown(page).getByText(copy.try, { exact: true })).toBeVisible();
		for (const chip of copy.suggestions) {
			await expect(
				searchDropdown(page).getByRole('button', { name: chip, exact: true })
			).toBeVisible();
		}
	});

	for (const url of ['/en/', '/en/dishes/tortilla/gal']) {
		test(
			`${url}: 54px below the field's top, right-aligned, min(440px, 100vw − 48px) wide`,
			{ tag: ['@layout'] },
			async ({ page }) => {
				await gotoHydrated(page, url);
				await typeInDesktopSearch(page, 'en', 'tortilla');
				await expectAnimationsSettled(searchDropdown(page), 'the dropdown');
				const field = await fieldBox(page);
				const panel = await dropdownBox(page);
				expectPx(panel.y - field.y, DROPDOWN.belowFieldTop, 'dropdown top below the field top');
				expectPx(right(panel), right(field), 'dropdown right edge');
				const width = Math.min(DROPDOWN.width, (await innerWidth(page)) - DROPDOWN.sideMargin);
				expectPx(panel.width, width, 'dropdown width');
				expect(panel.x, 'got the dropdown past the window’s left edge').toBeGreaterThanOrEqual(0);
			}
		);
	}

	test('caps at 520px and scrolls inside itself', { tag: ['@layout'] }, async ({ page }) => {
		await gotoHydrated(page, '/en/');
		await typeInDesktopSearch(page, 'en', MANY_RESULTS_QUERY);
		await expectAnimationsSettled(searchDropdown(page), 'the dropdown');
		const panel = await dropdownBox(page);
		expectPx(panel.height, DROPDOWN.maxHeight, 'dropdown height');
		const scrolled = await searchDropdown(page).evaluate((el) => {
			el.scrollTop = el.scrollHeight;
			return { top: el.scrollTop, windowY: window.scrollY };
		});
		expect(scrolled.top, 'want the dropdown itself to scroll').toBeGreaterThan(0);
		expect(scrolled.windowY, 'got the window scrolling instead').toBe(0);
	});

	test('is rounded 18px with the README shadow', async ({ page }) => {
		await gotoHydrated(page, '/en/');
		await typeInDesktopSearch(page, 'en', 'tortilla');
		const css = await computedStyle(searchDropdown(page), ['border-top-left-radius', 'box-shadow']);
		expect(css['border-top-left-radius']).toBe(DROPDOWN_RADIUS);
		expect(css['box-shadow']).toBe(DROPDOWN_SHADOW);
	});

	for (const url of ['/en/', '/en/?tab=popular']) {
		test(`every row is on top of the page at ${url}`, { tag: ['@layout'] }, async ({ page }) => {
			await gotoHydrated(page, url);
			await typeInDesktopSearch(page, 'en', 'tortilla');
			await expectAnimationsSettled(searchDropdown(page), 'the dropdown');
			for (const option of await searchDropdown(page).getByRole('option').all()) {
				expect(await isOnTop(option), `got ${await option.textContent()} covered`).toBe(true);
			}
		});
	}
});

test.describe('desktop search in every locale', () => {
	for (const lang of SEARCH_LOCALES) {
		test(`${lang}: no results says "nothing for" the query`, async ({ page }) => {
			await gotoHydrated(page, `/${lang}/`);
			await typeInDesktopSearch(page, lang, 'zzzz');
			await expect(
				searchDropdown(page).getByText(nothingFor(lang, 'zzzz'), { exact: true })
			).toBeVisible();
			await expect(
				searchDropdown(page).getByText(SEARCH_COPY[lang].hint, { exact: true })
			).toBeVisible();
		});
	}

	const FINDS: { lang: SearchLocale; query: string; group: 0 | 1 | 2; title: string }[] = [
		{ lang: 'ru', query: 'paella', group: DISHES, title: DISH_NAMES.ru.paella },
		{ lang: 'ru', query: 'андалусия', group: REGIONS, title: 'Андалусия' },
		{ lang: 'es', query: 'andalucia', group: REGIONS, title: 'Andalucía' },
		{ lang: 'en', query: 'betanzos', group: VARIATIONS, title: BETANZOS.en.name }
	];

	for (const { lang, query, group, title } of FINDS) {
		test(`${lang}: "${query}" finds ${title}`, async ({ page }) => {
			await gotoHydrated(page, `/${lang}/`);
			await typeInDesktopSearch(page, lang, query);
			await expect(dropdownOption(dropdownGroup(page, lang, group), title)).toBeVisible();
		});
	}
});

test.describe('desktop search: closing', () => {
	test(
		'Escape closes it, keeps the query and focus in the field',
		{ tag: ['@cross-browser'] },
		async ({ page }) => {
			await gotoHydrated(page, '/en/');
			await typeInDesktopSearch(page, 'en', 'tortilla');
			await page.keyboard.press('Escape');
			await expectDropdownClosed(page, 'en');
			await expect(desktopSearchInput(page, 'en')).toHaveValue('tortilla');
			await expect(desktopSearchInput(page, 'en')).toBeFocused();
			expect(pathAndQuery(page), 'got Escape navigating').toBe('/en/');
		}
	);

	test(
		'an outside click closes it and keeps the query',
		{ tag: ['@cross-browser'] },
		async ({ page }) => {
			await gotoHydrated(page, '/en/');
			await typeInDesktopSearch(page, 'en', 'tortilla');
			await page.getByRole('heading', { level: 1, name: HOME_COPY.en.aboutTitle }).click();
			await expectDropdownClosed(page, 'en');
			await expect(desktopSearchInput(page, 'en')).toHaveValue('tortilla');
			expect(pathAndQuery(page), 'got the click navigating').toBe('/en/');
		}
	);

	test('Tab out of the search closes it', { tag: ['@cross-browser'] }, async ({ page }) => {
		await gotoHydrated(page, '/en/');
		await typeInDesktopSearch(page, 'en', 'tortilla');
		// Past the "×" (and a scrollable dropdown, which Chromium makes a Tab
		// stop) to the language button, the next control in the top bar.
		await tabTo(page, languageButton(page, 'en'), MAX_TABS_OUT_OF_SEARCH);
		await expectDropdownClosed(page, 'en');
	});
});

test.describe('desktop search: keyboard', () => {
	test(
		'arrow keys move through results with focus in the field; Enter opens the recipe',
		{ tag: ['@cross-browser'] },
		async ({ page }) => {
			await gotoHydrated(page, '/en/');
			// "betanzos": the dish (its variation names are indexed), then the variation.
			await typeInDesktopSearch(page, 'en', 'betanzos');
			await page.keyboard.press('ArrowDown');
			await page.keyboard.press('ArrowDown');
			await expect(desktopSearchInput(page, 'en')).toBeFocused();
			const active = await desktopSearchInput(page, 'en').getAttribute('aria-activedescendant');
			await expect(page.locator(`[id="${active}"]`)).toContainText(BETANZOS.en.name);
			await page.keyboard.press('Enter');
			await expectUrl(page, '/en/dishes/tortilla/gal');
		}
	);
});

test.describe('desktop search: selecting', () => {
	test('a variation opens its recipe as one new entry; the dropdown closes', async ({ page }) => {
		await gotoHydrated(page, '/en/');
		const before = await historyLength(page);
		await typeInDesktopSearch(page, 'en', 'betanzos');
		await pick(page, 'en', VARIATIONS, BETANZOS.en.name);
		await expectUrl(page, '/en/dishes/tortilla/gal');
		expect(await historyLength(page), 'want exactly one new history entry').toBe(before + 1);
		await expectSearchReset(page, 'en');
		await page.goBack();
		await expectUrl(page, '/en/');
	});

	test('a dish opens its Variations page; the pill returns to the Regional home', async ({
		page
	}) => {
		await gotoHydrated(page, '/en/');
		const before = await historyLength(page);
		await typeInDesktopSearch(page, 'en', 'tortilla');
		await pick(page, 'en', DISHES, 'Tortilla de patatas');
		await expectUrl(page, '/en/dishes/tortilla');
		expect(await historyLength(page), 'want one new entry, no Popular replace').toBe(before + 1);
		await expectSelectedTab(page, 'en', 'regional');
		await expectPillWithHref(page, HOME_COPY.en.regional, '/en/');
		await clickPill(page);
		await expectUrl(page, '/en/');
	});

	test('a region opens its panel and clears the field', async ({ page }) => {
		await gotoHydrated(page, '/en/');
		await typeInDesktopSearch(page, 'en', 'galicia');
		await pick(page, 'en', REGIONS, 'Galicia');
		await expectUrl(page, '/en/regions/gal');
		await expect(regionPanel(page, 'Galicia')).toBeVisible();
		await expectSearchReset(page, 'en');
	});

	test('from Popular, the recipe pill reads Popular and returns to the filtered list', async ({
		page
	}) => {
		await gotoHydrated(page, HOME_WITH_FILTERS);
		await typeInDesktopSearch(page, 'en', 'betanzos');
		await pick(page, 'en', VARIATIONS, BETANZOS.en.name);
		await expectUrl(page, '/en/dishes/tortilla/gal');
		await expectPillWithHref(page, HOME_COPY.en.popular, HOME_WITH_FILTERS);
		await page.goBack();
		await expectUrl(page, HOME_WITH_FILTERS);
	});

	test('from a region, the recipe pill reads the region and returns to it', async ({ page }) => {
		await gotoHydrated(page, '/en/regions/gal');
		await typeInDesktopSearch(page, 'en', 'betanzos');
		await pick(page, 'en', VARIATIONS, BETANZOS.en.name);
		await expectUrl(page, '/en/dishes/tortilla/gal');
		await expectPillWithHref(page, BETANZOS.en.region, '/en/regions/gal');
		await clickPill(page);
		await expectUrl(page, '/en/regions/gal');
	});

	test("from another dish's Variations page, the recipe pill names that dish and returns to it", async ({
		page
	}) => {
		await gotoHydrated(page, '/en/dishes/paella');
		await typeInDesktopSearch(page, 'en', 'betanzos');
		await pick(page, 'en', VARIATIONS, BETANZOS.en.name);
		await expectUrl(page, '/en/dishes/tortilla/gal');
		await expectPillWithHref(page, DISH_NAMES.en.paella, '/en/dishes/paella');
		await clickPill(page);
		await expectUrl(page, '/en/dishes/paella');
	});

	test('from another region, the recipe pill names the origin region and returns to it', async ({
		page
	}) => {
		await gotoHydrated(page, '/en/regions/and');
		await typeInDesktopSearch(page, 'en', 'betanzos');
		await pick(page, 'en', VARIATIONS, BETANZOS.en.name);
		await expectUrl(page, '/en/dishes/tortilla/gal');
		await expectPillWithHref(page, 'Andalucía', '/en/regions/and');
		await clickPill(page);
		await expectUrl(page, '/en/regions/and');
	});

	test('from a Recipe page, a region result opens its panel', async ({ page }) => {
		await gotoHydrated(page, '/en/dishes/tortilla/gal');
		await typeInDesktopSearch(page, 'en', 'andalucia');
		await pick(page, 'en', REGIONS, 'Andalucía');
		await expectUrl(page, '/en/regions/and');
		await expect(regionPanel(page, 'Andalucía')).toBeVisible();
	});

	test('ru: "paella" picks the rice dish', async ({ page }) => {
		await gotoHydrated(page, '/ru/');
		await typeInDesktopSearch(page, 'ru', 'paella');
		await pick(page, 'ru', DISHES, DISH_NAMES.ru.paella);
		await expectUrl(page, '/ru/dishes/paella');
	});
});

test.describe('desktop search: crossing 860px', () => {
	test(
		'narrowing closes the dropdown; it stays closed back on desktop',
		{ tag: ['@layout'] },
		async ({ page }) => {
			const height = page.viewportSize()!.height;
			await gotoHydrated(page, '/en/');
			await typeInDesktopSearch(page, 'en', 'tortilla');
			await expect(desktopSearchInput(page, 'en')).toHaveAttribute('aria-expanded', 'true');
			// A handle, not a locator: below 860px the desktop top bar is hidden,
			// so the visible-banner locator no longer finds the field.
			const field = (await desktopSearchInput(page, 'en').elementHandle())!;
			await page.setViewportSize({ width: MOBILE_WIDTH, height });
			// The dropdown is CSS-hidden at once; aria-expanded="false" shows the
			// page itself saw the narrowing before we widen again.
			await expect(searchDropdown(page)).toBeHidden();
			await expect
				.poll(() => field.getAttribute('aria-expanded'), { message: 'want the page to close it' })
				.toBe('false');
			await page.setViewportSize({ width: DESKTOP_WIDTH, height });
			await expectDropdownClosed(page, 'en');
		}
	);

	test(
		'widening with the mobile overlay open moves focus to the desktop field',
		{ tag: ['@layout'] },
		async ({ page }) => {
			const height = page.viewportSize()!.height;
			await page.setViewportSize({ width: MOBILE_WIDTH, height });
			await gotoHydrated(page, '/en/');
			await openSearch(page, 'en');
			await page.setViewportSize({ width: DESKTOP_WIDTH, height });
			await expect(desktopSearchInput(page, 'en')).toBeFocused();
		}
	);
});

test.describe('desktop search: accessibility', () => {
	for (const url of ['/en/', '/en/dishes/tortilla/gal']) {
		test(
			`${url}: no axe violations with the dropdown open`,
			{ tag: ['@cross-browser'] },
			async ({ page }) => {
				await gotoHydrated(page, url);
				await typeInDesktopSearch(page, 'en', 'tortilla');
				await expectAnimationsSettled(searchDropdown(page), 'the dropdown');
				await expectNoViolations(page, `${url} with the search dropdown open`);
			}
		);
	}

	test(
		'no axe violations with the suggestions open',
		{ tag: ['@cross-browser'] },
		async ({ page }) => {
			await gotoHydrated(page, '/en/');
			await focusDesktopSearch(page, 'en');
			await expectAnimationsSettled(searchDropdown(page), 'the dropdown');
			await expectNoViolations(page, '/en/ with the search suggestions open');
		}
	);
});

test.describe('desktop search: nothing persisted', () => {
	test(
		'the query never reaches the URL, storage or a cookie',
		{ tag: ['@cross-browser'] },
		async ({ page, context }) => {
			await page.addInitScript(installStorageSpy);
			await gotoHydrated(page, '/en/');
			const urls = recordUrls(page);
			await typeInDesktopSearch(page, 'en', 'galic');
			await onlyVisible(
				page.getByRole('button', { name: SEARCH_COPY.en.clear, exact: true })
			).click();
			await searchDropdown(page).getByRole('button', { name: 'Paella', exact: true }).click();
			await page.keyboard.press('Escape');
			expect(urls, 'got a navigation while searching').toEqual([]);
			await desktopSearchInput(page, 'en').fill('andalucia');
			await pick(page, 'en', REGIONS, 'Andalucía');
			await expectUrl(page, '/en/regions/and');
			const visited = urls.map((url) => new URL(url).pathname + new URL(url).search);
			expect(visited, 'want one navigation, without the query').toEqual(['/en/regions/and']);
			const writes = await recordedWrites(page);
			expect(writes, `got writes ${JSON.stringify(writes)}, want none`).toEqual([]);
			const state = await context.storageState();
			expect(state.cookies, `got cookies ${JSON.stringify(state.cookies)}, want none`).toEqual([]);
		}
	);
});

test.describe('desktop search: server HTML', () => {
	for (const url of TOP_BAR_PAGES) {
		test(`${url}: one combobox, disabled until hydrated, with the placeholder`, async ({
			request
		}, testInfo) => {
			onlyInHtmlProject(testInfo);
			const res = await getRaw(request, url);
			expect(res.status(), `got status ${res.status()}, want 200`).toBe(200);
			const tags = startTags(await res.text()).filter((t) => t.attrs.role === 'combobox');
			expect(tags.length, 'want exactly one combobox in the server HTML').toBe(1);
			const [field] = tags;
			expect(field.name).toBe('input');
			expect('disabled' in field.attrs, 'want the server field disabled').toBe(true);
			expect(field.attrs.placeholder).toBe(DESKTOP_PLACEHOLDER.en);
		});
	}
});

test.describe('desktop search without JavaScript', () => {
	test.use({ javaScriptEnabled: false });

	test('the field is shown but disabled', async ({ page }) => {
		await page.goto('/en/');
		await expect(desktopSearchInput(page, 'en')).toBeVisible();
		await expect(desktopSearchInput(page, 'en')).toBeDisabled();
	});
});
