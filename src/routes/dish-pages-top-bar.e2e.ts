import { expect, test, type Locator, type Page } from '@playwright/test';
import { backPill, expectUrl, useShortWindow } from '../testutil/desktop-pages-e2e';
import {
	boxOf,
	expectPx,
	expectSameDocument,
	gotoHydrated,
	HOME_COPY,
	markDocument,
	onlyVisible,
	tab
} from '../testutil/home-e2e';
import { dishCard, skipOnMobile } from '../testutil/popular-e2e';
import {
	BETANZOS,
	RECIPE_LOCALES,
	variationsPath,
	type RecipeLocale
} from '../testutil/recipe-copy';
import { clientNavigate } from '../testutil/recipe-e2e';
import { historyLength, regionPanel } from '../testutil/region-e2e';
import { recipePath, TORTILLA_PAGE } from '../testutil/variations-copy';
import { scrollWindowTo, variationCards } from '../testutil/variations-e2e';

// FE-6 PR 4, the desktop (≥ 860px) top bar on the Variations and Recipe
// pages (stage FE-6 -> Small decisions, updated in PR 4; desktop prototype:
// the top bar sits above every view).
//
// Decisions pinned here:
// - The same DesktopTopBar as home: the "Asadorov" logo links to /:lang/;
//   the Regional | Popular switch links to the home tabs (/:lang/ and
//   /:lang/?tab=popular) and shows the ORIGIN tab as selected: Popular on a
//   direct load, Regional when the page was reached from the Regional home
//   or a region page, Popular from Popular. A Recipe reached from Variations
//   keeps the Variations page's tab (the prototype's `tab` carries over).
// - The language button is the home's: the current code and the localized
//   "Language" label. The language menu is FE-7 (home's button is still a
//   placeholder), so the language-switch case goes through /set-lang, which
//   the menu will link to (setLangHref): the same page path comes back in
//   the new locale.
// - Keyboard (stage FE-6 -> Small decisions, PR 4 review): here the switch
//   uses MANUAL activation. ArrowLeft / ArrowRight / Home / End only move
//   focus between the tabs; the URL, the page, the history and the selected
//   (origin) tab stay. Enter, like a click, follows the focused tab's link
//   as a new history entry. (Home keeps automatic activation.)
// - The bar is not sticky (76px plus a hairline at the very top, scrolled
//   away with the page), so the pill sits under it and the ingredients
//   card's top: 24px still applies.

const TOP_BAR_OUTER_HEIGHT_PX = 77;
const SCROLL_PAST_BAR_PX = 400;
const LOGO = 'Asadorov';

type DeskPage = { name: string; path: (lang: RecipeLocale) => string };

const PAGES: DeskPage[] = [
	{ name: 'Variations', path: (lang) => variationsPath(lang, 'tortilla') },
	{ name: 'Recipe', path: (lang) => recipePath(lang, 'tortilla', 'gal') }
];

const logoLink = (page: Page): Locator =>
	onlyVisible(page.getByRole('link', { name: LOGO, exact: true }));

const topBar = (page: Page): Locator => logoLink(page).locator('xpath=ancestor::header[1]');

const languageButton = (page: Page, lang: RecipeLocale): Locator =>
	onlyVisible(page.getByRole('button', { name: new RegExp(HOME_COPY[lang].language) }));

async function expectSelectedTab(page: Page, lang: RecipeLocale, which: 'popular' | 'regional') {
	const other = which === 'popular' ? 'regional' : 'popular';
	await expect(tab(page, HOME_COPY[lang][which])).toHaveAttribute('aria-selected', 'true');
	await expect(tab(page, HOME_COPY[lang][other])).toHaveAttribute('aria-selected', 'false');
}

// Opens a page and fails fast, by name, when it has no desktop top bar.
async function openWithBar(page: Page, url: string) {
	await gotoHydrated(page, url);
	await expect(topBar(page), 'want the desktop top bar').toBeVisible();
}

test.beforeEach(({ page }) => skipOnMobile(page, 'the desktop top bar (≥ 860px)'));

test.describe('Desktop top bar on the Variations and Recipe pages', () => {
	for (const { name, path } of PAGES) {
		for (const lang of RECIPE_LOCALES) {
			const copy = HOME_COPY[lang];

			test(`${name} ${path(lang)}: logo, "${copy.regional} | ${copy.popular}" with ${copy.popular} selected, language ${lang.toUpperCase()}`, async ({
				page
			}) => {
				await gotoHydrated(page, path(lang));
				await expect(logoLink(page), 'want one visible logo link').toHaveCount(1);
				await expect(logoLink(page)).toHaveAttribute('href', `/${lang}/`);
				const tablist = onlyVisible(page.getByRole('tablist', { name: copy.tabsLabel }));
				await expect(tablist, 'want one visible switch').toHaveCount(1);
				await expect(tab(page, copy.regional)).toHaveAttribute('href', `/${lang}/`);
				await expect(tab(page, copy.popular)).toHaveAttribute('href', `/${lang}/?tab=popular`);
				await expectSelectedTab(page, lang, 'popular');
				await expect(languageButton(page, lang)).toHaveCount(1);
				await expect(languageButton(page, lang)).toContainText(lang.toUpperCase());
			});
		}

		test(
			`${name}: the bar is 76px plus its hairline at the top, the pill below it`,
			{ tag: '@layout' },
			async ({ page }) => {
				await openWithBar(page, path('en'));
				const bar = await boxOf(topBar(page), 'the top bar');
				expectPx(bar.y, 0, 'top bar y');
				expectPx(bar.height, TOP_BAR_OUTER_HEIGHT_PX, 'top bar outer height');
				await expect(backPill(page), 'want the desktop back pill').toBeVisible();
				const pill = await boxOf(backPill(page), 'the back pill');
				expect(pill.y, 'want the pill under the bar').toBeGreaterThanOrEqual(bar.y + bar.height);
			}
		);

		test(
			`${name}: the bar is not sticky; it scrolls away with the page`,
			{ tag: ['@layout', '@cross-browser'] },
			async ({ page }) => {
				await useShortWindow(page);
				await openWithBar(page, path('en'));
				const y = await scrollWindowTo(page, SCROLL_PAST_BAR_PX);
				expect(y, 'want the page scrolled').toBeGreaterThan(TOP_BAR_OUTER_HEIGHT_PX);
				const bar = await topBar(page).evaluate((el) => el.getBoundingClientRect().bottom);
				expect(bar, 'want the bar scrolled out of view').toBeLessThanOrEqual(0);
			}
		);
	}
});

test.describe('Desktop top bar: the origin tab', () => {
	test(
		'Variations from a region page shows Regional; after Recipe and Back it still does',
		{ tag: '@cross-browser' },
		async ({ page }) => {
			await gotoHydrated(page, '/en/regions/gal');
			await clientNavigate(page, '/en/dishes/tortilla');
			await expectUrl(page, '/en/dishes/tortilla');
			await expectSelectedTab(page, 'en', 'regional');
			await variationCards(page).first().click();
			await expectUrl(page, recipePath('en', 'tortilla', 'gal'));
			await expectSelectedTab(page, 'en', 'regional');
			await page.goBack();
			await expectUrl(page, '/en/dishes/tortilla');
			await expectSelectedTab(page, 'en', 'regional');
		}
	);

	test('Variations from the Regional home shows Regional', async ({ page }) => {
		await gotoHydrated(page, '/en/');
		await clientNavigate(page, '/en/dishes/tortilla');
		await expectUrl(page, '/en/dishes/tortilla');
		await expectSelectedTab(page, 'en', 'regional');
	});

	test('Variations from Popular shows Popular', async ({ page }) => {
		await gotoHydrated(page, '/en/?tab=popular');
		await dishCard(page, 'tortilla').click();
		await expectUrl(page, '/en/dishes/tortilla');
		await expectSelectedTab(page, 'en', 'popular');
	});

	for (const lang of RECIPE_LOCALES) {
		const betanzos = recipePath(lang, 'tortilla', 'gal');

		test(
			`${lang}: a Recipe from the Galicia panel shows ${HOME_COPY[lang].regional}`,
			{ tag: lang === 'en' ? ['@cross-browser'] : [] },
			async ({ page }) => {
				await gotoHydrated(page, `/${lang}/regions/gal`);
				await regionPanel(page, BETANZOS[lang].region).locator(`a[href="${betanzos}"]`).click();
				await expectUrl(page, betanzos);
				await expectSelectedTab(page, lang, 'regional');
			}
		);
	}
});

test.describe('Desktop top bar: links', () => {
	test('the Regional tab on Variations opens the Regional home (a new entry)', async ({ page }) => {
		await openWithBar(page, '/en/dishes/tortilla');
		const entries = await historyLength(page);
		await tab(page, HOME_COPY.en.regional).click();
		await expectUrl(page, '/en/');
		expect(await historyLength(page), 'want a new history entry').toBe(entries + 1);
	});

	test('the Popular tab on the Recipe page opens Popular', async ({ page }) => {
		await openWithBar(page, recipePath('ru', 'tortilla', 'gal'));
		await tab(page, HOME_COPY.ru.popular).click();
		await expectUrl(page, '/ru/?tab=popular');
	});

	test('the logo on the Recipe page opens the home', async ({ page }) => {
		await openWithBar(page, recipePath('es', 'tortilla', 'gal'));
		await logoLink(page).click();
		await expectUrl(page, '/es/');
	});
});

test.describe('Desktop top bar: manual activation from the keyboard', () => {
	// A key on the focused tab moves focus to `to` and changes nothing else:
	// the origin tab stays selected (automatic activation would move
	// aria-selected at once), and once the network is idle (a client
	// navigation fetches its data) the URL and the history are the same.
	async function expectFocusOnlyMove(page: Page, key: string, to: Locator, selected: Locator) {
		const url = page.url();
		const entries = await historyLength(page);
		await page.keyboard.press(key);
		await expect(to, `want focus on the tab after ${key}`).toBeFocused();
		await expect(selected, `want the origin tab still selected after ${key}`).toHaveAttribute(
			'aria-selected',
			'true'
		);
		await page.waitForLoadState('networkidle');
		expect(page.url(), `got a navigation on ${key}, want the URL kept`).toBe(url);
		expect(await historyLength(page), `got a history entry on ${key}`).toBe(entries);
	}

	test(
		'en Variations: ArrowLeft moves focus to Regional only; Enter opens /en/',
		{ tag: '@cross-browser' },
		async ({ page }) => {
			await openWithBar(page, '/en/dishes/tortilla');
			await markDocument(page);
			await tab(page, HOME_COPY.en.popular).focus();
			await expectFocusOnlyMove(
				page,
				'ArrowLeft',
				tab(page, HOME_COPY.en.regional),
				tab(page, HOME_COPY.en.popular)
			);
			await expectSelectedTab(page, 'en', 'popular');
			await expectSameDocument(page, 'after ArrowLeft');
			await expect(page.getByRole('heading', { level: 1 })).toHaveText(TORTILLA_PAGE.en.name);
			const entries = await historyLength(page);
			await page.keyboard.press('Enter');
			await expectUrl(page, '/en/');
			expect(await historyLength(page), 'want Enter to add a history entry').toBe(entries + 1);
		}
	);

	test(
		'en Variations: ArrowRight wraps, Home and End move focus, the URL stays',
		{ tag: '@cross-browser' },
		async ({ page }) => {
			await openWithBar(page, '/en/dishes/tortilla');
			const regional = tab(page, HOME_COPY.en.regional);
			const popular = tab(page, HOME_COPY.en.popular);
			await popular.focus();
			await expectFocusOnlyMove(page, 'ArrowRight', regional, popular);
			await expectFocusOnlyMove(page, 'End', popular, popular);
			await expectFocusOnlyMove(page, 'Home', regional, popular);
			await expectSelectedTab(page, 'en', 'popular');
			await expectUrl(page, '/en/dishes/tortilla');
		}
	);

	test(
		'en Recipe from Galicia: ArrowRight to Popular, then Enter opens Popular',
		{ tag: '@cross-browser' },
		async ({ page }) => {
			const betanzos = recipePath('en', 'tortilla', 'gal');
			await gotoHydrated(page, '/en/regions/gal');
			await regionPanel(page, BETANZOS.en.region).locator(`a[href="${betanzos}"]`).click();
			await expectUrl(page, betanzos);
			await expect(topBar(page), 'want the desktop top bar').toBeVisible();
			await tab(page, HOME_COPY.en.regional).focus();
			await expectFocusOnlyMove(
				page,
				'ArrowRight',
				tab(page, HOME_COPY.en.popular),
				tab(page, HOME_COPY.en.regional)
			);
			await expectSelectedTab(page, 'en', 'regional');
			await page.keyboard.press('Enter');
			await expectUrl(page, '/en/?tab=popular');
		}
	);

	test('ru Recipe: ArrowRight moves focus to По регионам only; Enter opens /ru/', async ({
		page
	}) => {
		await openWithBar(page, recipePath('ru', 'tortilla', 'gal'));
		await tab(page, HOME_COPY.ru.popular).focus();
		await expectFocusOnlyMove(
			page,
			'ArrowRight',
			tab(page, HOME_COPY.ru.regional),
			tab(page, HOME_COPY.ru.popular)
		);
		await expectSelectedTab(page, 'ru', 'popular');
		await expect(page.getByRole('heading', { level: 1 })).toHaveText(BETANZOS.ru.name);
		await page.keyboard.press('Enter');
		await expectUrl(page, '/ru/');
	});
});

test.describe('Desktop top bar: switching language keeps the page', () => {
	test('en Recipe → es (via /set-lang): the same path in es, the bar reads ES', async ({
		page
	}) => {
		await gotoHydrated(page, recipePath('en', 'tortilla', 'gal'));
		await expect(languageButton(page, 'en')).toContainText('EN');
		const next = recipePath('es', 'tortilla', 'gal');
		await page.goto(`/set-lang?to=es&next=${encodeURIComponent(next)}`, {
			waitUntil: 'networkidle'
		});
		await expectUrl(page, next);
		await expect(page.locator('html')).toHaveAttribute('lang', 'es');
		await expect(page.getByRole('heading', { level: 1 })).toHaveText(BETANZOS.es.name);
		await expect(languageButton(page, 'es')).toContainText('ES');
		await expectSelectedTab(page, 'es', 'popular');
		await expect(backPill(page)).toHaveText(TORTILLA_PAGE.es.name);
	});
});
