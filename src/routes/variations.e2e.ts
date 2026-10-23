import { expect, test, type Locator, type Page, type TestInfo } from '../testutil/e2e-test';
import { expectNoViolations } from '../testutil/axe-e2e';
import {
	expectHomeRestored,
	expectUrl,
	leaveScrolledHome,
	LOWEST_DISH,
	seeAllFromSheet
} from '../testutil/home-flow-e2e';
import { skipAgainstDeployment } from '../testutil/e2e-target';
import { expectNoVariationStandsOut } from '../testutil/equal-variations-e2e';
import { expectSameDocument, gotoHydrated, markDocument } from '../testutil/home-e2e';
import { TORTILLA_SHEET, VARIATION_REGIONS } from '../testutil/popular-copy';
import { skipOnDesktop } from '../testutil/popular-e2e';
import { expectSheetPeek, historyLength } from '../testutil/region-e2e';
import {
	backFallback,
	PAGE_COPY,
	recipePath,
	TORTILLA_PAGE,
	VARIATIONS_LOCALES,
	VARIATIONS_THRESHOLD_PX
} from '../testutil/variations-copy';
import {
	backLink,
	expectBar,
	expectBarStuckAtTop,
	pagePushMarks,
	recordPagePushMarks,
	scrollWindowTo,
	variationCards,
	windowScrollY
} from '../testutil/variations-e2e';

// FE-6 PR 2, the mobile Variations page (4a) end to end (stage FE-6 ->
// Variations page, Preparation, Small decisions, D-FE6-1; mobile README ->
// Screen 2 and State: "Back on the Variations page returns to home with its
// previous state intact").
//
// Decisions pinned here (FE-6 PR 2):
// - The page scrolls the WINDOW (no inner scroll container), so the
//   StickyTopBar tracks window scroll: title and hairline past 230px.
// - Back button: the SSR href is /:lang/?tab=popular&dish=<key>; after
//   hydration, when the previous history entry is an in-app page, a click
//   is history.back() (no new entry), so home returns with its exact URL;
//   otherwise (direct entry, even after visiting a recipe and coming back)
//   it follows the href.
// - Home's Popular list scroll position is a SvelteKit `snapshot` (D-FE6-1):
//   restored by the back button and by browser Back alike.
// - Forward navigation into the page starts it at the top.
// - Desktop (FE-6 PR 4) shares the content, the 404 and the card links;
//   its pill, layout and scroll are variations-desktop.e2e.ts and
//   desktop-navigation.e2e.ts. The StickyTopBar, the mobile sizes, the page
//   push and the home sheet flows are mobile only.

const PAST_THRESHOLD_PX = VARIATIONS_THRESHOLD_PX + 1;
const FAR_DOWN_PX = 600;
const HERO_PX = 180;
const CARD_PHOTO_PX = 130;

const MOBILE_ONLY = 'the mobile Variations layout (< 860px)';
const skipMobileOnly = ({ page }: { page: Page }) => skipOnDesktop(page, MOBILE_ONLY);

async function cardHrefs(page: Page): Promise<string[]> {
	return variationCards(page).evaluateAll((cards) =>
		cards.map((c) => c.getAttribute('href') ?? '')
	);
}

async function boxHeight(locator: Locator): Promise<number> {
	const box = await locator.boundingBox();
	expect(box, 'got no box').not.toBeNull();
	return box!.height;
}

test.describe('Variations page without JavaScript', () => {
	test.use({ javaScriptEnabled: false });

	for (const lang of VARIATIONS_LOCALES) {
		const copy = TORTILLA_PAGE[lang];
		const url = `/${lang}/dishes/tortilla`;

		test(`${url}: header, count, description and every card in region order`, async ({ page }) => {
			const res = await page.goto(url);
			expect(res?.status()).toBe(200);
			await expect(page.getByRole('heading', { level: 1 })).toHaveText(copy.name);
			await expect(page.getByText(copy.count, { exact: true })).toBeVisible();
			await expect(page.getByText(copy.description, { exact: true })).toBeVisible();
			const want = VARIATION_REGIONS.tortilla.map((r) => recipePath(lang, 'tortilla', r));
			expect(await cardHrefs(page)).toEqual(want);
		});

		test(`${url}: a card reads region, name, description, "${PAGE_COPY[lang].viewRecipe}"`, async ({
			page
		}) => {
			await page.goto(url);
			const [first] = copy.cards;
			const card = variationCards(page).first();
			for (const part of [
				first.region,
				first.name,
				first.description,
				PAGE_COPY[lang].viewRecipe
			]) {
				await expect(card, `got no "${part}"`).toContainText(part, { ignoreCase: true });
			}
		});

		test(`${url}: no map, and the back link goes to ${backFallback(lang, 'tortilla')}`, async ({
			page
		}) => {
			skipOnDesktop(page, MOBILE_ONLY);
			await page.goto(url);
			await expect(page.getByTestId('region-map')).toHaveCount(0);
			await expect(backLink(page, lang)).toHaveAttribute('href', backFallback(lang, 'tortilla'));
		});
	}

	test(`hero photo ${HERO_PX}px, card photos ${CARD_PHOTO_PX}px`, async ({ page }) => {
		skipOnDesktop(page, MOBILE_ONLY);
		skipAgainstDeployment('asserts the photo placeholder');
		await page.goto('/en/dishes/tortilla');
		// No MEDIA_BASE_URL in E2E: every <Photo> is its placeholder box.
		expect(await boxHeight(page.locator('.placeholder').first())).toBe(HERO_PX);
		const cardPhoto = variationCards(page).first().locator('.placeholder');
		expect(await boxHeight(cardPhoto)).toBe(CARD_PHOTO_PX);
	});
});

test.describe('Variations page: unknown dish', () => {
	for (const lang of VARIATIONS_LOCALES) {
		test(`/${lang}/dishes/nope is a 404 in ${lang}`, async ({ page }) => {
			const res = await page.goto(`/${lang}/dishes/nope`);
			expect(res?.status(), `got ${res?.status()}, want 404`).toBe(404);
			await expect(page.locator('html')).toHaveAttribute('lang', lang);
			await expect(page.locator('h1')).toHaveText(PAGE_COPY[lang].notFoundTitle);
		});
	}
});

test.describe('Variations page: sticky top bar on window scroll', () => {
	test.beforeEach(skipMobileOnly);

	for (const lang of VARIATIONS_LOCALES) {
		const name = TORTILLA_PAGE[lang].name;

		// Sticky is an engine check too, once per engine (en).
		const tag = lang === 'en' ? ['@layout', '@cross-browser'] : ['@layout'];
		test(
			`${lang}: title and hairline appear past ${VARIATIONS_THRESHOLD_PX}px, the bar stays stuck`,
			{ tag },
			async ({ page }) => {
				await gotoHydrated(page, `/${lang}/dishes/tortilla`);
				await expectBar(page, lang, name, false);
				expect(await scrollWindowTo(page, VARIATIONS_THRESHOLD_PX)).toBe(VARIATIONS_THRESHOLD_PX);
				await expectBar(page, lang, name, false);
				expect(await scrollWindowTo(page, PAST_THRESHOLD_PX)).toBe(PAST_THRESHOLD_PX);
				await expectBar(page, lang, name, true);
				await scrollWindowTo(page, FAR_DOWN_PX);
				await expectBarStuckAtTop(page, lang);
				await scrollWindowTo(page, 0);
				await expectBar(page, lang, name, false);
			}
		);
	}

	test(
		'after the page push from home: starts at the top, then tracks window scroll',
		{ tag: '@cross-browser' },
		async ({ page }) => {
			await gotoHydrated(page, '/en/?tab=popular');
			await seeAllFromSheet(page, 'en', 'tortilla');
			expect(await windowScrollY(page), 'want the page to start at the top').toBe(0);
			await expectBar(page, 'en', TORTILLA_PAGE.en.name, false);
			expect(await scrollWindowTo(page, FAR_DOWN_PX)).toBe(FAR_DOWN_PX);
			await expectBar(page, 'en', TORTILLA_PAGE.en.name, true);
			await expectBarStuckAtTop(page, 'en');
		}
	);
});

test.describe('Variations page: back button', () => {
	test.beforeEach(skipMobileOnly);

	for (const lang of VARIATIONS_LOCALES) {
		test(`${lang}: on a direct entry it goes to ${backFallback(lang, 'tortilla')}`, async ({
			page
		}) => {
			await gotoHydrated(page, `/${lang}/dishes/tortilla`);
			await backLink(page, lang).click();
			await expectUrl(page, backFallback(lang, 'tortilla'));
			await expectSheetPeek(page, TORTILLA_SHEET[lang].name);
		});
	}

	test(
		'from home it returns to the exact home URL, sheet open, list scroll restored',
		{ tag: '@cross-browser' },
		async ({ page }) => {
			const home = await leaveScrolledHome(page);
			await markDocument(page);
			const entries = await historyLength(page);
			await backLink(page, 'en').click();
			await expectHomeRestored(page, home);
			expect(await historyLength(page), 'want history.back(), not a new entry').toBe(entries);
			await expectSameDocument(page, 'back from the Variations page');
		}
	);

	test(
		'browser Back does the same: exact home URL, sheet open, list scroll restored',
		{ tag: '@cross-browser' },
		async ({ page }) => {
			const home = await leaveScrolledHome(page);
			await page.goBack();
			await expectHomeRestored(page, home);
		}
	);

	test('home → Variations → Recipe → Back → back button restores the home', async ({ page }) => {
		const home = await leaveScrolledHome(page);
		await variationCards(page).first().click();
		await page.waitForURL((url) => /^\/en\/dishes\/arrozleche\/[a-z]+$/.test(url.pathname));
		await page.goBack();
		await expectUrl(page, `/en/dishes/${LOWEST_DISH}`);
		await backLink(page, 'en').click();
		await expectHomeRestored(page, home);
	});

	test('direct entry → Recipe → Back: the back button still stays in the app', async ({ page }) => {
		await gotoHydrated(page, '/en/dishes/tortilla');
		await variationCards(page).first().click();
		await expectUrl(page, recipePath('en', 'tortilla', 'gal'));
		await page.goBack();
		await expectUrl(page, '/en/dishes/tortilla');
		await backLink(page, 'en').click();
		await expectUrl(page, backFallback('en', 'tortilla'));
	});
});

test.describe('Variations page: cards open the recipe', () => {
	for (const lang of VARIATIONS_LOCALES) {
		const second = TORTILLA_PAGE[lang].cards[1];

		test(`${lang}: the ${second.region} card opens ${recipePath(lang, 'tortilla', second.regionKey)}`, async ({
			page
		}) => {
			await gotoHydrated(page, `/${lang}/dishes/tortilla`);
			await variationCards(page).nth(1).click();
			await expectUrl(page, recipePath(lang, 'tortilla', second.regionKey));
			await expect(page.getByRole('heading', { level: 1 })).toHaveText(second.name);
		});
	}
});

// Root CLAUDE.md scope rule: "All variations of a dish are equal" (no best or
// primary variation highlight), on both layouts.
test.describe('Variations page: every variation is equal', () => {
	test('no card stands out: every card looks the same, none is marked', async ({ page }) => {
		await gotoHydrated(page, '/en/dishes/tortilla');
		await expectNoVariationStandsOut(variationCards(page), 'variation cards');
	});
});

test.describe('Variations page: page push from home', () => {
	test.beforeEach(skipMobileOnly);

	test('slides in (a push mark)', { tag: '@cross-browser' }, async ({ page }) => {
		await gotoHydrated(page, '/en/?tab=popular');
		await recordPagePushMarks(page);
		await seeAllFromSheet(page, 'en', 'tortilla');
		const marks = await pagePushMarks(page);
		expect(
			marks.some((m) => m === 'push' || m === 'slide'),
			`got marks ${marks}`
		).toBe(true);
	});

	test.describe('under reduced motion', () => {
		test.use({ reducedMotion: 'reduce' });

		test('only fades', { tag: '@cross-browser' }, async ({ page }) => {
			await gotoHydrated(page, '/en/?tab=popular');
			await recordPagePushMarks(page);
			await seeAllFromSheet(page, 'en', 'tortilla');
			const marks = await pagePushMarks(page);
			expect(marks.length, 'want a page transition mark').toBeGreaterThan(0);
			expect(new Set(marks), `got marks ${marks}`).toEqual(new Set(['fade']));
		});
	});
});

// stack.md F4: one axe pass per engine; WebKit runs the @cross-browser scan.
const AXE_PROJECTS = ['chromium-mobile-390', 'webkit-iphone'];

function onlyInAxeProject(testInfo: TestInfo) {
	test.skip(
		!AXE_PROJECTS.includes(testInfo.project.name),
		`axe runs in ${AXE_PROJECTS.join(', ')}`
	);
}

test.describe('axe: WCAG 2.2 AA on the Variations page', () => {
	for (const url of ['/en/dishes/tortilla', '/ru/dishes/tortilla', '/es/dishes/paella']) {
		const tag = url === '/en/dishes/tortilla' ? ['@cross-browser'] : [];
		test(`${url} has no violations`, { tag }, async ({ page }, testInfo) => {
			onlyInAxeProject(testInfo);
			await gotoHydrated(page, url);
			await expect(variationCards(page).first()).toBeVisible();
			await expectNoViolations(page, url);
		});
	}

	test('/en/dishes/tortilla scrolled past the threshold has no violations', async ({
		page
	}, testInfo) => {
		onlyInAxeProject(testInfo);
		await gotoHydrated(page, '/en/dishes/tortilla');
		await scrollWindowTo(page, FAR_DOWN_PX);
		await expectBar(page, 'en', TORTILLA_PAGE.en.name, true);
		await expectNoViolations(page, '/en/dishes/tortilla (scrolled)');
	});
});
