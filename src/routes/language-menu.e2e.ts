import { expect, test, type Page, type TestInfo } from '../testutil/e2e-test';
import { expectAnimationsSettled } from '../testutil/animations-e2e';
import { getRaw, LOCALES, setCookieHeaders } from '../testutil/e2e';
import {
	boxOf,
	gotoHydrated,
	HOME_COPY,
	isDesktopPage,
	onlyVisible,
	pathAndQuery,
	right,
	tab,
	expectPx
} from '../testutil/home-e2e';
import { expectUrl } from '../testutil/home-flow-e2e';
import { elementsWith, startTags } from '../testutil/html';
import {
	CURRENT_MARK,
	LANGUAGE_ROWS,
	MENU_EYEBROW,
	switchHref,
	type MenuLocale
} from '../testutil/language-menu-copy';
import {
	expectMenuClosed,
	focusedRow,
	isOnTop,
	languageButton,
	languageMenu,
	menuRow,
	openMenu,
	openMenuByKeyboard,
	recordSetLangResponses
} from '../testutil/language-menu-e2e';
import { DISH_NAMES } from '../testutil/popular-copy';
import { skipOnDesktop, skipOnMobile } from '../testutil/popular-e2e';
import { BETANZOS } from '../testutil/recipe-copy';
import { expectSheetPeek, GALICIA_RU, regionPanel } from '../testutil/region-e2e';
import { expectSelectedTab } from '../testutil/search-e2e';
import { installStorageSpy, recordedWrites } from '../testutil/storage-spy';
import { TORTILLA_PAGE } from '../testutil/variations-copy';

// FE-7 PR 3, the header language menu end to end, mobile and desktop.
//
// Sources:
// - Both READMEs -> Overlay — Language menu (mobile L154–159, desktop
//   L67–72): mobile "top 70px in 2a …; right 16px, width 200px"; desktop
//   "top 54px under the button, right-aligned, width 210px"; "A transparent
//   full-screen layer behind it closes it on outside tap."
// - Stage FE-7 -> Language menu, Desktop search and menu (last bullet),
//   Acceptance: "Switching the language on /es/regions/gal?… lands on
//   /ru/regions/gal?… with the sheet still open"; "Picking RU sets lang=ru
//   (HttpOnly, Secure, SameSite=Lax) … A later visit to / redirects to /ru/,
//   even with Accept-Language: en"; "No storage writes, and no cookie other
//   than lang"; "The … menu work[s] with the keyboard alone. Escape closes
//   … Focus returns to the button that opened it"; "It works without
//   JavaScript" (D-FE1-1, X6). The prototype's localStorage['asadorov.lang']
//   is not ported.
// - Root CLAUDE.md X6: the URL path decides the language; the one cookie is
//   set only by /set-lang when the user picks a language.
//
// Decisions pinned here (FE-7 PR 3):
// - APG menu button: the button has aria-haspopup ("menu" or "true"),
//   aria-expanded and aria-controls = the shown menu's id. Enter, Space and
//   ArrowDown open the menu on the FIRST row (English) and ArrowUp on the
//   LAST (APG; the prototype has no keyboard model, and the first row keeps
//   the order predictable whatever the current language). Arrows wrap;
//   Home/End jump; Escape closes and refocuses the button; Tab closes.
// - An outside tap only closes the menu: it doesn't reach what is under it.
// - The menu is drawn above everything in the header and the page, and above
//   a peeking sheet's scrim, so a keyboard user who reaches the button with
//   a sheet open (peek is not modal) can switch; the sheet stays open.
// - Mobile Variations/Recipe pages have no language button (their sticky top
//   bar is back + title only: mobile README Screen 2/3, prototypes
//   DishVariations/Recipe.dc.html), so dish and recipe switching is desktop.
// - Without JavaScript the language button still reveals the three links,
//   and the server HTML holds them (a real <a href="/set-lang?…"> per row).

const HTML_PROJECT = 'chromium-mobile-390';

function onlyInHtmlProject(testInfo: TestInfo) {
	test.skip(testInfo.project.name !== HTML_PROJECT, `HTML checks run in ${HTML_PROJECT} only`);
}

const NO_DISH_PAGE_BUTTON = 'mobile Variations/Recipe pages have no language button';

// Mobile README: "top 70px in 2a …; right 16px"; desktop prototype L822
// "top:54px;right:0" inside the button's positioned wrapper.
const MOBILE_MENU = { width: 200, top: 70, right: 16 };
const DESKTOP_MENU = { width: 210, belowButtonTop: 54 };

async function pickByKeyboard(page: Page, from: MenuLocale, to: MenuLocale) {
	await openMenuByKeyboard(page, from);
	const steps = LANGUAGE_ROWS.findIndex((row) => row.code === to);
	for (let i = 0; i < steps; i++) await page.keyboard.press('ArrowDown');
	await page.keyboard.press('Enter');
}

async function pickByPointer(page: Page, from: MenuLocale, to: MenuLocale) {
	await openMenu(page, from);
	await menuRow(page, from, to).click();
}

async function expectFocusedRow(page: Page, want: string, after: string) {
	await expect.poll(() => focusedRow(page), { message: `focused row after ${after}` }).toBe(want);
}

async function expectLanguage(page: Page, lang: MenuLocale) {
	await expect(page.locator('html')).toHaveAttribute('lang', lang);
	await expect(languageButton(page, lang)).toContainText(lang.toUpperCase());
}

test.describe('language menu: opening and closing', () => {
	test('the button opens the menu it controls', async ({ page }) => {
		await gotoHydrated(page, '/en/');
		const button = languageButton(page, 'en');
		await expect(button).toHaveAttribute('aria-haspopup', /^(menu|true)$/);
		await expect(button).toHaveAttribute('aria-expanded', 'false');
		await openMenu(page, 'en');
		const id = await languageMenu(page, 'en').getAttribute('id');
		expect(id, 'want the menu to have an id').toBeTruthy();
		await expect(button).toHaveAttribute('aria-controls', id!);
	});

	test(
		'works from the keyboard: Enter, arrows, Home/End, Escape refocuses the button',
		{ tag: ['@cross-browser'] },
		async ({ page }) => {
			await gotoHydrated(page, '/en/');
			await openMenuByKeyboard(page, 'en');
			const walk: [string, string][] = [
				['ArrowDown', 'Español'],
				['End', 'Русский'],
				['ArrowDown', 'English'],
				['ArrowUp', 'Русский'],
				['Home', 'English']
			];
			await expectFocusedRow(page, 'English', 'Enter');
			for (const [key, want] of walk) {
				await page.keyboard.press(key);
				await expectFocusedRow(page, want, key);
			}
			await page.keyboard.press('Escape');
			await expectMenuClosed(page, 'en');
			await expect(languageButton(page, 'en')).toBeFocused();
			expect(pathAndQuery(page), 'got Escape navigating').toBe('/en/');
		}
	);

	const openKeys: { key: string; want: string }[] = [
		{ key: 'Enter', want: 'English' },
		{ key: 'Space', want: 'English' },
		{ key: 'ArrowDown', want: 'English' },
		{ key: 'ArrowUp', want: 'Русский' }
	];
	for (const { key, want } of openKeys) {
		test(`${key} on the button opens the menu on ${want}`, async ({ page }) => {
			await gotoHydrated(page, '/es/');
			await openMenuByKeyboard(page, 'es', key);
			await expectFocusedRow(page, want, key);
		});
	}

	test('Tab closes the menu and leaves it', async ({ page }) => {
		await gotoHydrated(page, '/en/');
		await openMenuByKeyboard(page, 'en');
		await page.keyboard.press('Tab');
		await expectMenuClosed(page, 'en');
		await expect
			.poll(() => focusedRow(page), { message: 'got focus left in the menu' })
			.toMatch(/^\(focus on/);
	});

	test('an outside tap closes it without activating what is under it', async ({ page }) => {
		await gotoHydrated(page, '/en/?tab=popular');
		await openMenu(page, 'en');
		const regional = await boxOf(onlyVisible(tab(page, HOME_COPY.en.regional)), 'Regional');
		await page.mouse.click(regional.x + 8, regional.y + regional.height / 2);
		await expectMenuClosed(page, 'en');
		expect(pathAndQuery(page), 'got the tap switching the tab').toBe('/en/?tab=popular');
	});

	test('a second click on the button closes it', async ({ page }) => {
		await gotoHydrated(page, '/en/');
		await openMenu(page, 'en');
		const button = await boxOf(languageButton(page, 'en'), 'the language button');
		await page.mouse.click(button.x + button.width / 2, button.y + button.height / 2);
		await expectMenuClosed(page, 'en');
	});

	for (const url of ['/en/', '/en/?tab=popular']) {
		test(`every row is on top of the page at ${url}`, { tag: ['@layout'] }, async ({ page }) => {
			await gotoHydrated(page, url);
			await openMenu(page, 'en');
			for (const { code } of LANGUAGE_ROWS) {
				expect(await isOnTop(menuRow(page, 'en', code)), `got the ${code} row covered`).toBe(true);
			}
		});
	}
});

test.describe('language menu: placement', () => {
	test(
		'mobile: 200px wide, 70px from the top, 16px from the right',
		{ tag: ['@layout'] },
		async ({ page }) => {
			skipOnDesktop(page, 'the mobile dropdown (< 860px)');
			await gotoHydrated(page, '/en/');
			await openMenu(page, 'en');
			await expectAnimationsSettled(languageMenu(page, 'en'), 'the menu');
			const menu = await boxOf(languageMenu(page, 'en'), 'the menu');
			const { width } = page.viewportSize()!;
			expectPx(menu.width, MOBILE_MENU.width, 'menu width');
			expectPx(menu.y, MOBILE_MENU.top, 'menu top');
			expectPx(width - right(menu), MOBILE_MENU.right, 'menu right inset');
		}
	);

	for (const url of ['/en/', '/en/dishes/tortilla', '/en/dishes/tortilla/gal']) {
		test(
			`desktop ${url}: 210px wide, 54px below the button top, right-aligned`,
			{ tag: ['@layout'] },
			async ({ page }) => {
				skipOnMobile(page, 'the desktop dropdown (≥ 860px)');
				await gotoHydrated(page, url);
				const button = await boxOf(languageButton(page, 'en'), 'the language button');
				await openMenu(page, 'en');
				await expectAnimationsSettled(languageMenu(page, 'en'), 'the menu');
				const menu = await boxOf(languageMenu(page, 'en'), 'the menu');
				expectPx(menu.width, DESKTOP_MENU.width, 'menu width');
				expectPx(menu.y - button.y, DESKTOP_MENU.belowButtonTop, 'menu top below the button');
				expectPx(right(menu), right(button), 'menu right edge');
			}
		);
	}
});

test.describe('language menu: content in every locale', () => {
	for (const lang of LOCALES) {
		test(`${lang}: "${MENU_EYEBROW[lang].toUpperCase()}", three rows, ✓ on ${lang}`, async ({
			page
		}) => {
			await gotoHydrated(page, `/${lang}/?tab=popular`);
			await openMenu(page, lang);
			const menu = languageMenu(page, lang);
			await expect(menu.getByText(MENU_EYEBROW[lang], { exact: true })).toBeVisible();
			const eyebrow = menu.getByText(MENU_EYEBROW[lang], { exact: true });
			expect(await eyebrow.evaluate((el) => (el as HTMLElement).innerText.trim())).toBe(
				MENU_EYEBROW[lang].toUpperCase()
			);
			await expect(menu.getByRole('menuitem')).toHaveCount(LANGUAGE_ROWS.length);
			for (const { code } of LANGUAGE_ROWS) {
				const row = menuRow(page, lang, code);
				await expect(row).toHaveAttribute('href', switchHref(code, '/?tab=popular'));
				if (code === lang) await expect(row).toContainText(CURRENT_MARK);
				else await expect(row).toContainText(code.toUpperCase());
			}
			await expect(menuRow(page, lang, lang)).toHaveAttribute('aria-current', /^(true|page)$/);
		});
	}

	for (const [i, from] of LOCALES.entries()) {
		const to = LOCALES[(i + 1) % LOCALES.length];
		test(`${from} → ${to} keeps Popular`, { tag: ['@cross-browser'] }, async ({ page }) => {
			await gotoHydrated(page, `/${from}/?tab=popular`);
			await pickByPointer(page, from, to);
			await expectUrl(page, `/${to}/?tab=popular`);
			await expectLanguage(page, to);
			await expectSelectedTab(page, to, 'popular');
		});
	}
});

test.describe('language menu: switching keeps the page and its URL state', () => {
	test('/es/regions/gal → /ru/regions/gal with the region still open', async ({ page }) => {
		await gotoHydrated(page, '/es/regions/gal');
		await pickByKeyboard(page, 'es', 'ru');
		await expectUrl(page, '/ru/regions/gal');
		await expectLanguage(page, 'ru');
		if (isDesktopPage(page)) {
			await expect(regionPanel(page, GALICIA_RU.name)).toBeVisible();
			return;
		}
		await expectSheetPeek(page, GALICIA_RU.name);
	});

	test('mobile: the menu opens above a peeking sheet; Escape closes only the menu', async ({
		page
	}) => {
		skipOnDesktop(page, 'the mobile region sheet');
		await gotoHydrated(page, '/es/regions/gal');
		await openMenuByKeyboard(page, 'es');
		for (const { code } of LANGUAGE_ROWS) {
			expect(await isOnTop(menuRow(page, 'es', code)), `got the ${code} row covered`).toBe(true);
		}
		await page.keyboard.press('Escape');
		await expectMenuClosed(page, 'es');
		expect(pathAndQuery(page), 'got Escape closing the sheet too').toBe('/es/regions/gal');
	});

	test('Popular filters survive a switch', async ({ page }) => {
		await gotoHydrated(page, '/en/?tab=popular&f=tapas&f=mains');
		await pickByPointer(page, 'en', 'es');
		await expectUrl(page, '/es/?tab=popular&f=tapas&f=mains');
		await expectLanguage(page, 'es');
		await expectSelectedTab(page, 'es', 'popular');
	});

	test('mobile: the ?dish= sheet survives a switch', async ({ page }) => {
		skipOnDesktop(page, 'the mobile dish sheet (desktop ignores ?dish=)');
		await gotoHydrated(page, '/en/?tab=popular&dish=tortilla');
		await pickByKeyboard(page, 'en', 'ru');
		await expectUrl(page, '/ru/?tab=popular&dish=tortilla');
		await expectSheetPeek(page, DISH_NAMES.ru.tortilla);
	});

	test('from a Variations page', { tag: ['@cross-browser'] }, async ({ page }) => {
		skipOnMobile(page, NO_DISH_PAGE_BUTTON);
		await gotoHydrated(page, '/en/dishes/tortilla');
		await pickByPointer(page, 'en', 'ru');
		await expectUrl(page, '/ru/dishes/tortilla');
		await expectLanguage(page, 'ru');
		await expect(page.getByRole('heading', { level: 1 })).toHaveText(TORTILLA_PAGE.ru.name);
	});

	test('from a Recipe page', async ({ page }) => {
		skipOnMobile(page, NO_DISH_PAGE_BUTTON);
		await gotoHydrated(page, '/en/dishes/tortilla/gal');
		await pickByKeyboard(page, 'en', 'es');
		await expectUrl(page, '/es/dishes/tortilla/gal');
		await expectLanguage(page, 'es');
		await expect(page.getByRole('heading', { level: 1 })).toHaveText(BETANZOS.es.name);
	});
});

test.describe('language menu: the lang cookie', () => {
	test('picking RU sets lang=ru (HttpOnly, Secure, SameSite=Lax); / then goes to /ru/', async ({
		page,
		context,
		browserName
	}) => {
		// Chromium and Firefox keep a Secure cookie from http://127.0.0.1 (checked
		// for FE-7 PR 3); WebKit is unverified locally, so it sits this one out.
		test.skip(browserName === 'webkit', 'a Secure cookie over plain http');
		await gotoHydrated(page, '/en/?tab=popular');
		const responses = recordSetLangResponses(page);
		await pickByPointer(page, 'en', 'ru');
		await expectUrl(page, '/ru/?tab=popular');
		expect(responses.length, 'want one /set-lang response').toBe(1);
		const cookies = (await responses[0].headersArray())
			.filter((h) => h.name.toLowerCase() === 'set-cookie')
			.map((h) => h.value);
		expect(cookies.length, `got ${JSON.stringify(cookies)}, want one Set-Cookie`).toBe(1);
		const [pair, ...attrs] = cookies[0].split(';').map((part) => part.trim().toLowerCase());
		expect(pair).toBe('lang=ru');
		for (const want of ['httponly', 'secure', 'samesite=lax', 'path=/']) {
			expect(attrs, `got ${JSON.stringify(attrs)}, want ${want}`).toContain(want);
		}
		const jar = (await context.cookies()).map(({ name, value, httpOnly, secure, sameSite }) => ({
			name,
			value,
			httpOnly,
			secure,
			sameSite
		}));
		expect(jar).toEqual([
			{ name: 'lang', value: 'ru', httpOnly: true, secure: true, sameSite: 'Lax' }
		]);
		await page.setExtraHTTPHeaders({ 'accept-language': 'en' });
		await page.goto('/');
		await expectUrl(page, '/ru/');
	});

	test(
		'opening, moving and picking write no storage and no other cookie',
		{ tag: ['@cross-browser'] },
		async ({ page, context }) => {
			await page.addInitScript(installStorageSpy);
			await gotoHydrated(page, '/en/?tab=popular');
			await openMenuByKeyboard(page, 'en');
			await page.keyboard.press('ArrowDown');
			await page.keyboard.press('Escape');
			await expectMenuClosed(page, 'en');
			await pickByPointer(page, 'en', 'es');
			await expectUrl(page, '/es/?tab=popular');
			const writes = await recordedWrites(page);
			expect(writes, `got writes ${JSON.stringify(writes)}, want none`).toEqual([]);
			const state = await context.storageState();
			const others = state.cookies.filter((c) => c.name !== 'lang');
			expect(others, `got cookies ${JSON.stringify(others)}, want only lang`).toEqual([]);
			const stored = state.origins.filter((o) => o.localStorage.length > 0);
			expect(stored, `got localStorage ${JSON.stringify(stored)}, want none`).toEqual([]);
		}
	);
});

test.describe('language menu without JavaScript', () => {
	test.use({ javaScriptEnabled: false });

	// Whatever element the server renders for the button (a <button> or a
	// <summary>), it is the visible control holding the localized label.
	const noJsButton = (page: Page) =>
		onlyVisible(page.locator(':is(button, summary)', { hasText: HOME_COPY.es.language }));

	test(
		'the button still reveals the links, and Русский switches',
		{ tag: ['@cross-browser'] },
		async ({ page }) => {
			const rest = '/?tab=popular&f=tapas';
			await page.goto(`/es${rest}`);
			await noJsButton(page).click();
			const russian = onlyVisible(page.locator(`a[href="${switchHref('ru', rest)}"]`));
			await expect(russian).toBeVisible();
			await russian.click();
			await expectUrl(page, `/ru${rest}`);
			await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
		}
	);

	// The no-JS form is plain links inside <details>: Tab from the opened
	// summary must reach them (a tabindex="-1" row is skipped).
	test(
		'keyboard: Enter opens it, Tab reaches the first row, Enter on Русский switches',
		{ tag: ['@cross-browser'] },
		async ({ page }) => {
			const rest = '/regions/gal';
			await page.goto(`/es${rest}`);
			await noJsButton(page).focus();
			await page.keyboard.press('Enter');
			await page.keyboard.press('Tab');
			const focused = await focusedHref(page);
			expect(focused, `got focus on ${focused}`).toBe(switchHref(LANGUAGE_ROWS[0].code, rest));
			await tabTo(page, switchHref('ru', rest));
			await page.keyboard.press('Enter');
			await expectUrl(page, `/ru${rest}`);
			await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
		}
	);
});

// The focused element's href (decoded), or its tag when it is not a link.
function focusedHref(page: Page): Promise<string> {
	return page.evaluate(() => {
		const el = document.activeElement;
		return el?.getAttribute('href') ?? `(focus on <${el?.tagName.toLowerCase()}>)`;
	});
}

async function tabTo(page: Page, href: string) {
	for (let i = 0; i < LANGUAGE_ROWS.length; i++) {
		if ((await focusedHref(page)) === href) return;
		await page.keyboard.press('Tab');
	}
	expect(await focusedHref(page), `want Tab to reach ${href}`).toBe(href);
}

test.describe('language menu: server HTML', () => {
	const pages = [
		{ url: '/es/regions/gal', rest: '/regions/gal' },
		{ url: '/en/?tab=popular&f=tapas&dish=tortilla', rest: '/?tab=popular&f=tapas&dish=tortilla' },
		{ url: '/ru/dishes/tortilla/gal', rest: '/dishes/tortilla/gal' }
	];
	for (const { url, rest } of pages) {
		test(`${url} holds a /set-lang link per language`, async ({ request }, testInfo) => {
			onlyInHtmlProject(testInfo);
			const res = await getRaw(request, url);
			expect(res.status(), `got status ${res.status()}, want 200`).toBe(200);
			expect(setCookieHeaders(res), 'got a page setting a cookie').toEqual([]);
			const html = (await res.text()).replaceAll('&amp;', '&');
			for (const { code } of LANGUAGE_ROWS) {
				const href = switchHref(code, rest);
				expect(html.includes(`href="${href}"`), `want a link to ${href}`).toBe(true);
			}
		});

		// Before hydration the menu is plain links in a <details>; menu roles and
		// roving tabindex="-1" would take the rows out of the no-JS Tab order.
		test(`${url}: the server menu is plain links, no menu roles or tabindex -1`, async ({
			request
		}, testInfo) => {
			onlyInHtmlProject(testInfo);
			const menus = serverMenus(await (await getRaw(request, url)).text());
			expect(menus.length, 'got no language menu in the server HTML').toBeGreaterThan(0);
			for (const menu of menus) {
				const tags = startTags(menu);
				const id = tags[0].attrs.id;
				const roles = tags.map((t) => t.attrs.role).filter((r) => MENU_ROLES.has(r));
				expect(roles, `${id}: got menu roles`).toEqual([]);
				const rows = tags.filter((t) => t.name === 'a');
				expect(rows.length, `${id}: want a link per language`).toBe(LANGUAGE_ROWS.length);
				const minusOne = rows.filter((t) => t.attrs.tabindex === '-1').map((t) => t.attrs.lang);
				expect(minusOne, `${id}: got rows with tabindex="-1"`).toEqual([]);
			}
		});
	}
});

const SERVER_MENU_IDS = ['language-menu-mobile', 'language-menu-desktop'];
const MENU_ROLES = new Set(['menu', 'menuitem']);

// Each language menu element in the page HTML.
function serverMenus(html: string): string[] {
	return SERVER_MENU_IDS.flatMap((id) => elementsWith(html, ` id="${id}"`));
}
