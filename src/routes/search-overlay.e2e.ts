import { expect, test, type Page } from '../testutil/e2e-test';
import { gotoHydrated, onlyVisible, pathAndQuery } from '../testutil/home-e2e';
import { expectUrl, HOME_WITH_FILTERS } from '../testutil/home-flow-e2e';
import { skipOnDesktop } from '../testutil/popular-e2e';
import {
	expectSheetHidden,
	expectSheetPeek,
	historyLength,
	tapScrim
} from '../testutil/region-e2e';
import {
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
	resultGroup,
	resultOption,
	searchButton,
	searchDialog,
	searchFor,
	searchInput,
	VARIATIONS
} from '../testutil/search-e2e';
import { installStorageSpy, recordedWrites } from '../testutil/storage-spy';
import { backLink } from '../testutil/variations-e2e';

// FE-7 PR 2, the mobile search overlay end to end (< 860px; the desktop
// inline search is PR 4, so every test here skips at desktop widths).
//
// Sources:
// - Mobile README -> Overlay — Search; Information architecture ("Search is
//   an overlay, not a route"); Accessibility.
// - Stage FE-7 -> Search overlay and Acceptance: "In /ru/, typing "paella"
//   shows the paella dish. Typing "андалусия" shows the region."; "The
//   overlay … work[s] with the keyboard alone. Escape closes … Focus returns
//   to the button that opened it."; "No storage writes, and no cookie other
//   than lang".
//
// Decisions pinned here (FE-7 PR 2):
// - Selecting a dish or a variation on mobile opens /:lang/dishes/:dishKey
//   as ONE new history entry, and Back (browser or the page's back link)
//   lands on the Popular tab: the README's "switch to Popular and open that
//   dish's Variations page". So when the overlay was opened on another tab,
//   the home entry is first replaced by /:lang/?tab=popular (no extra
//   history entry); already on Popular, its URL (filters) is kept. FE-6's
//   recordOrigin then reads Popular from that entry, and inAppBack's
//   history.back() returns to it.
// - Selecting a region pushes /:lang/regions/:key (Regional tab, sheet
//   peek), one new entry, so Back returns to where search was opened.
// - The header button announces its dialog: aria-haspopup="dialog" and
//   aria-expanded.

const searchUrl = (lang: SearchLocale) => `/${lang}/`;

test.beforeEach(({ page }) =>
	skipOnDesktop(page, 'the mobile search overlay (desktop is FE-7 PR 4)')
);

async function expectCoversScreen(page: Page) {
	const { width, height } = page.viewportSize()!;
	const points = [
		[4, 4],
		[width / 2, height / 2],
		[width - 4, height - 4]
	];
	const covered = await searchDialog(page, 'en').evaluate(
		(dialog, pts) => pts.map(([x, y]) => dialog.contains(document.elementFromPoint(x, y))),
		points
	);
	expect(covered, `got points outside the overlay: ${JSON.stringify(points)}`).toEqual(
		points.map(() => true)
	);
}

async function pickResult(page: Page, lang: SearchLocale, group: 0 | 1 | 2, title: string) {
	await resultOption(resultGroup(page, lang, group), title).click();
}

test.describe('search overlay: opening and closing', () => {
	test('the header button opens the overlay as a dialog', async ({ page }) => {
		await gotoHydrated(page, searchUrl('en'));
		const button = searchButton(page, 'en');
		await expect(button).toHaveAttribute('aria-haspopup', 'dialog');
		await expect(button).toHaveAttribute('aria-expanded', 'false');
		await expect(searchDialog(page, 'en')).toBeHidden();
		await openSearch(page, 'en');
		await expect(searchDialog(page, 'en')).toHaveAttribute('aria-modal', 'true');
		await expect(button).toHaveAttribute('aria-expanded', 'true');
	});

	// Over home content only: every other home layer (the region sheet's
	// scrim, the modal Filters sheet) covers the header, search button included.
	for (const url of ['/en/', '/en/?tab=popular']) {
		test(
			`covers the whole screen, above the home content at ${url}`,
			{
				tag: ['@layout']
			},
			async ({ page }) => {
				await gotoHydrated(page, url);
				await openSearch(page, 'en');
				await expectCoversScreen(page);
			}
		);
	}

	test(
		'works from the keyboard: Enter opens, Escape closes and refocuses the button',
		{ tag: ['@cross-browser'] },
		async ({ page }) => {
			await gotoHydrated(page, searchUrl('en'));
			const button = searchButton(page, 'en');
			await button.focus();
			await page.keyboard.press('Enter');
			await expect(searchInput(page, 'en')).toBeFocused();
			await page.keyboard.press('Escape');
			await expect(searchDialog(page, 'en')).toBeHidden();
			await expect(button).toBeFocused();
			expect(pathAndQuery(page), 'got Escape navigating').toBe('/en/');
		}
	);

	test('Cancel closes, clears the query and refocuses the button', async ({ page }) => {
		await gotoHydrated(page, searchUrl('en'));
		await searchFor(page, 'en', 'tortilla');
		await searchDialog(page, 'en').getByRole('button', { name: 'Cancel', exact: true }).click();
		await expect(searchDialog(page, 'en')).toBeHidden();
		await expect(searchButton(page, 'en')).toBeFocused();
		await openSearch(page, 'en');
		await expect(searchInput(page, 'en')).toHaveValue('');
	});
});

// Chromium's DevTools protocol slows every animation on the page, so the
// 350ms enter transition is still running when the next key arrives,
// however fast the runner types (no reliance on timing).
const SLOW_PLAYBACK_RATE = 0.1;

async function setAnimationRate(page: Page, playbackRate: number) {
	const cdp = await page.context().newCDPSession(page);
	await cdp.send('Animation.enable');
	await cdp.send('Animation.setPlaybackRate', { playbackRate });
}

// Whether focus is inside the dialog and its own transitions still run.
const focusDuringEnter = (page: Page) =>
	searchDialog(page, 'en').evaluate((dialog) => ({
		inside: dialog.contains(document.activeElement),
		focused: document.activeElement?.outerHTML.slice(0, 120) ?? null,
		entering: dialog.getAnimations().length > 0
	}));

// FE-7 PR 2 review: the overlay is modal from the moment it opens, though
// the input only takes focus once the enter transition ends (README: "Input
// auto-focuses after the transition"). A Tab before then must not reach the
// page under it, and Escape must still return focus to the search button.
test.describe('search overlay: focus during the enter transition', () => {
	test('Tab mid-transition stays in the dialog; Escape refocuses the button', async ({
		page,
		browserName
	}) => {
		test.skip(
			browserName !== 'chromium',
			'slows animations through the Chromium DevTools protocol'
		);
		await gotoHydrated(page, searchUrl('en'));
		const button = searchButton(page, 'en');
		await button.focus();
		await setAnimationRate(page, SLOW_PLAYBACK_RATE);
		await page.keyboard.press('Enter');
		await page.keyboard.press('Tab');
		const during = await focusDuringEnter(page);
		expect(during.entering, 'got the enter transition already over').toBe(true);
		expect(during.inside, `got focus outside the dialog mid-transition: ${during.focused}`).toBe(
			true
		);
		await setAnimationRate(page, 1);
		await page.keyboard.press('Escape');
		await expect(searchDialog(page, 'en')).toBeHidden();
		await expect(button).toBeFocused();
	});
});

// The README's overlay is mobile only (desktop has inline search, FE-7 PR 4),
// so crossing 860px closes it. Where focus lands then is PR 4's call.
const DESKTOP_WIDTH = 1000;
test.describe('search overlay: crossing 860px', () => {
	test('widening to desktop closes the overlay and leaves it inert', async ({ page }) => {
		await gotoHydrated(page, searchUrl('en'));
		await searchFor(page, 'en', 'tortilla');
		await page.setViewportSize({ width: DESKTOP_WIDTH, height: page.viewportSize()!.height });
		const overlay = page.getByRole('dialog', {
			name: SEARCH_COPY.en.dialog,
			exact: true,
			includeHidden: true
		});
		await expect(overlay).toBeHidden();
		await expect(overlay).toHaveAttribute('inert');
		await expect(overlay).not.toHaveAttribute('aria-modal');
	});
});

test.describe('search overlay in every locale', () => {
	for (const lang of SEARCH_LOCALES) {
		test(`${lang}: placeholder, Cancel and the suggestions`, async ({ page }) => {
			const copy = SEARCH_COPY[lang];
			await gotoHydrated(page, searchUrl(lang));
			await openSearch(page, lang);
			await expect(searchInput(page, lang)).toHaveAttribute('placeholder', copy.placeholder);
			const dialog = searchDialog(page, lang);
			await expect(dialog.getByRole('button', { name: copy.cancel, exact: true })).toBeVisible();
			await expect(dialog.getByText(copy.try, { exact: true })).toBeVisible();
			for (const chip of copy.suggestions) {
				await expect(dialog.getByRole('button', { name: chip, exact: true })).toBeVisible();
			}
		});

		test(`${lang}: no results says "nothing for" the query`, async ({ page }) => {
			await gotoHydrated(page, searchUrl(lang));
			await searchFor(page, lang, 'zzzz');
			const dialog = searchDialog(page, lang);
			await expect(dialog.getByText(nothingFor(lang, 'zzzz'), { exact: true })).toBeVisible();
			await expect(dialog.getByText(SEARCH_COPY[lang].hint, { exact: true })).toBeVisible();
		});
	}

	const FINDS: { lang: SearchLocale; query: string; group: 0 | 1 | 2; title: string }[] = [
		{ lang: 'ru', query: 'paella', group: DISHES, title: 'Блюда из риса' },
		{ lang: 'ru', query: 'андалусия', group: REGIONS, title: 'Андалусия' },
		{ lang: 'es', query: 'andalucia', group: REGIONS, title: 'Andalucía' },
		{ lang: 'en', query: 'betanzos', group: VARIATIONS, title: 'Betanzos-style runny' },
		{ lang: 'en', query: 'TORTILLA', group: DISHES, title: 'Tortilla de patatas' }
	];

	for (const { lang, query, group, title } of FINDS) {
		test(`${lang}: "${query}" finds ${title}`, async ({ page }) => {
			await gotoHydrated(page, searchUrl(lang));
			await searchFor(page, lang, query);
			await expect(resultOption(resultGroup(page, lang, group), title)).toBeVisible();
		});
	}

	test('ru: the "Рис" chip fills the query and finds the rice dish', async ({ page }) => {
		await gotoHydrated(page, searchUrl('ru'));
		await openSearch(page, 'ru');
		await searchDialog(page, 'ru').getByRole('button', { name: 'Рис', exact: true }).click();
		await expect(searchInput(page, 'ru')).toHaveValue('Рис');
		await expect(resultOption(resultGroup(page, 'ru', DISHES), 'Блюда из риса')).toBeVisible();
	});
});

test.describe('search overlay: selecting a result', () => {
	test('a dish opens its Variations page as one entry; Back lands on Popular', async ({ page }) => {
		await gotoHydrated(page, searchUrl('en'));
		const before = await historyLength(page);
		await searchFor(page, 'en', 'tortilla');
		await pickResult(page, 'en', DISHES, 'Tortilla de patatas');
		await expectUrl(page, '/en/dishes/tortilla');
		expect(await historyLength(page), 'want exactly one new history entry').toBe(before + 1);
		await page.goBack();
		await expectUrl(page, '/en/?tab=popular');
		await expectSelectedTab(page, 'en', 'popular');
		await expect(searchDialog(page, 'en')).toBeHidden();
	});

	test("the Variations page's back link also lands on Popular", async ({ page }) => {
		await gotoHydrated(page, '/en/regions/gal');
		await expectSheetPeek(page, 'Galicia');
		// The sheet's scrim covers the header: hide the sheet to reach search.
		await tapScrim(page);
		await expectSheetHidden(page);
		await searchFor(page, 'en', 'tortilla');
		await pickResult(page, 'en', DISHES, 'Tortilla de patatas');
		await expectUrl(page, '/en/dishes/tortilla');
		await onlyVisible(backLink(page, 'en')).click();
		await expectUrl(page, '/en/?tab=popular');
		await expectSelectedTab(page, 'en', 'popular');
	});

	test('a variation opens its dish (not its recipe) on mobile', async ({ page }) => {
		await gotoHydrated(page, searchUrl('en'));
		await searchFor(page, 'en', 'betanzos');
		await pickResult(page, 'en', VARIATIONS, 'Betanzos-style runny');
		await expectUrl(page, '/en/dishes/tortilla');
		await page.goBack();
		await expectUrl(page, '/en/?tab=popular');
	});

	test('opened on Popular, Back returns to the same filtered list', async ({ page }) => {
		await gotoHydrated(page, HOME_WITH_FILTERS);
		await searchFor(page, 'en', 'tortilla');
		await pickResult(page, 'en', DISHES, 'Tortilla de patatas');
		await expectUrl(page, '/en/dishes/tortilla');
		await page.goBack();
		await expectUrl(page, HOME_WITH_FILTERS);
	});

	test('a region opens the Regional tab with its sheet and closes the overlay', async ({
		page
	}) => {
		await gotoHydrated(page, '/en/?tab=popular');
		const before = await historyLength(page);
		await searchFor(page, 'en', 'andalucia');
		await pickResult(page, 'en', REGIONS, 'Andalucía');
		await expectUrl(page, '/en/regions/and');
		await expect(searchDialog(page, 'en')).toBeHidden();
		await expectSelectedTab(page, 'en', 'regional');
		await expectSheetPeek(page, 'Andalucía');
		expect(await historyLength(page), 'want exactly one new history entry').toBe(before + 1);
		await page.goBack();
		await expectUrl(page, '/en/?tab=popular');
	});

	test('arrow keys and Enter pick a result', { tag: ['@cross-browser'] }, async ({ page }) => {
		await gotoHydrated(page, searchUrl('en'));
		await searchFor(page, 'en', 'tortilla de');
		await page.keyboard.press('ArrowDown');
		await page.keyboard.press('Enter');
		await expectUrl(page, '/en/dishes/tortilla');
	});
});

test.describe('search overlay: nothing persisted', () => {
	test(
		'the query never reaches the URL, storage or a cookie',
		{ tag: ['@cross-browser'] },
		async ({ page, context }) => {
			await page.addInitScript(installStorageSpy);
			await gotoHydrated(page, searchUrl('en'));
			const urls = recordUrls(page);
			await searchFor(page, 'en', 'galic');
			await searchDialog(page, 'en')
				.getByRole('button', { name: 'Clear search', exact: true })
				.click();
			await searchDialog(page, 'en').getByRole('button', { name: 'Paella', exact: true }).click();
			await page.keyboard.press('Escape');
			expect(urls, 'got a navigation while searching').toEqual([]);
			await searchFor(page, 'en', 'andalucia');
			await pickResult(page, 'en', REGIONS, 'Andalucía');
			await expectUrl(page, '/en/regions/and');
			const visited = urls.map((url) => new URL(url).pathname + new URL(url).search);
			expect(visited, 'want one navigation, without the query').toEqual(['/en/regions/and']);
			const writes = await recordedWrites(page);
			expect(writes, `got writes ${JSON.stringify(writes)}, want none`).toEqual([]);
			const state = await context.storageState();
			expect(state.cookies, `got cookies ${JSON.stringify(state.cookies)}, want none`).toEqual([]);
			const stored = state.origins.filter((o) => o.localStorage.length > 0);
			expect(stored, `got localStorage ${JSON.stringify(stored)}, want none`).toEqual([]);
		}
	);
});
