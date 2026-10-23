import { expect, test, type Locator, type Page } from '../testutil/e2e-test';
import {
	backPill,
	clickPill,
	expectPill,
	expectPillWithHref,
	expectUrl,
	expectWindowScroll,
	MOBILE_WIDTH_PX,
	pillHomeLabel,
	useShortWindow
} from '../testutil/desktop-pages-e2e';
import { expectSameDocument, gotoHydrated, markDocument } from '../testutil/home-e2e';
import { dishCard, skipOnMobile } from '../testutil/popular-e2e';
import { BETANZOS, RECIPE_LOCALES, variationsPath } from '../testutil/recipe-copy';
import { clientNavigate } from '../testutil/recipe-e2e';
import { ANDALUCIA_EN, historyLength, regionPanel } from '../testutil/region-e2e';
import { recipePath, TORTILLA_PAGE, type VariationsLocale } from '../testutil/variations-copy';
import {
	backLink,
	pagePushMarks,
	recordPagePushMarks,
	variationCards
} from '../testutil/variations-e2e';

// FE-6 PR 4, desktop (≥ 860px) navigation between home, Variations and
// Recipe: the back pill's origin labels, where it goes, window scroll on
// forward and back navigation, and no page-push slide.
//
// Sources:
// - Desktop prototype L860–869 (wins over the README): dishBack = Popular
//   or Regional by the home tab; recipeBack = the dish name when the recipe
//   came from the Variations page, else Popular (Popular tab) or the
//   recipe's region (Regional tab); goBack returns to the dish view from a
//   recipe reached from it, else home.
// - Stage FE-6 -> Small decisions: the origin is the URL of the entry the
//   page was pushed from, recorded per history entry with the inAppBack
//   flag; an in-app origin swaps the label and a click is history.back();
//   a direct load shows Variations "‹ Popular" (href /:lang/?tab=popular)
//   and Recipe the dish name (href its Variations page); a link from a
//   deeper page (Recipe → Variations) records no origin.
// - Desktop README -> State: "Every navigation scrolls the content area to
//   the top"; the stage applies it to forward navigation only, and browser
//   Back restores the previous scroll.
// - CLAUDE.md -> Navigation: "there is no page push at ≥ 860px".
//
// Decisions pinned here (FE-6 PR 4):
// - Desktop has no way yet to reach Variations from Regional, or a recipe
//   from Popular (FE-7 search adds both; desktop search opens a variation's
//   recipe directly), so those origins are reached by an in-app link
//   (clientNavigate), which records the same push.
// - Once hydrated, an in-app origin swaps the label AND the href to the
//   origin URL (so a middle-click opens that page); a direct load keeps the
//   SSR href (stage FE-6 -> Small decisions, updated in PR 4).

const REGIONAL_ORIGINS = ['/regions/gal', '/'] as const;

const popularHome = (lang: string, query = '') => `/${lang}/?tab=popular${query}`;
const homePath = (lang: string, rest: string) => (rest === '/' ? `/${lang}/` : `/${lang}${rest}`);

test.beforeEach(({ page }) => skipOnMobile(page, 'the desktop back pill (≥ 860px)'));

// A pill click that is history.back(): the exact origin URL, same document,
// no new history entry.
async function expectPillGoesBack(page: Page, origin: string) {
	await markDocument(page);
	const entries = await historyLength(page);
	await clickPill(page);
	await expectUrl(page, origin);
	await expectSameDocument(page, 'after the pill click');
	expect(await historyLength(page), 'want history.back(), not a new entry').toBe(entries);
}

// A pill click that follows its href: a new history entry.
async function expectPillFollowsHref(page: Page, target: string) {
	const entries = await historyLength(page);
	await clickPill(page);
	await expectUrl(page, target);
	expect(await historyLength(page), 'want the href (a new entry)').toBe(entries + 1);
}

async function openTortillaFromPopular(page: Page, lang: VariationsLocale, query = '') {
	await gotoHydrated(page, popularHome(lang, query));
	await dishCard(page, 'tortilla').click();
	await expectUrl(page, `/${lang}/dishes/tortilla`);
}

async function openBetanzosFromVariations(page: Page, lang: VariationsLocale) {
	await variationCards(page).first().click();
	await expectUrl(page, recipePath(lang, 'tortilla', 'gal'));
}

test.describe('Variations back pill (desktop)', () => {
	for (const lang of RECIPE_LOCALES) {
		const popular = pillHomeLabel(lang, 'popular');
		const regional = pillHomeLabel(lang, 'regional');

		test(
			`${lang}: direct load reads "${popular}" and the click goes to /${lang}/?tab=popular`,
			{ tag: lang === 'en' ? ['@cross-browser'] : [] },
			async ({ page }) => {
				await gotoHydrated(page, `/${lang}/dishes/tortilla`);
				await expectPillWithHref(page, popular, popularHome(lang));
				await expectPillFollowsHref(page, popularHome(lang));
			}
		);

		test(
			`${lang}: from Popular it reads "${popular}"; the click returns to the filtered Popular`,
			{ tag: lang === 'en' ? ['@cross-browser'] : [] },
			async ({ page }) => {
				await openTortillaFromPopular(page, lang, '&f=vegetarian');
				await expectPillWithHref(page, popular, popularHome(lang, '&f=vegetarian'));
				await expectPillGoesBack(page, popularHome(lang, '&f=vegetarian'));
			}
		);

		for (const rest of REGIONAL_ORIGINS) {
			const origin = homePath(lang, rest);

			test(
				`${lang}: from ${origin} it reads "${regional}"; the click returns there`,
				{ tag: lang === 'en' ? ['@cross-browser'] : [] },
				async ({ page }) => {
					await gotoHydrated(page, origin);
					await clientNavigate(page, `/${lang}/dishes/tortilla`);
					await expectUrl(page, `/${lang}/dishes/tortilla`);
					await expectPillWithHref(page, regional, origin);
					await expectPillGoesBack(page, origin);
				}
			);
		}
	}

	test(
		'Popular → Variations → Recipe → browser Back: the pill still reads Popular and goes back',
		{ tag: '@cross-browser' },
		async ({ page }) => {
			await openTortillaFromPopular(page, 'en');
			await openBetanzosFromVariations(page, 'en');
			await page.goBack();
			await expectUrl(page, '/en/dishes/tortilla');
			await expectPillWithHref(page, pillHomeLabel('en', 'popular'), popularHome('en'));
			await expectPillGoesBack(page, popularHome('en'));
		}
	);

	test(
		'Regional → Variations → Recipe → browser Back: the pill still reads Regional',
		{ tag: '@cross-browser' },
		async ({ page }) => {
			await gotoHydrated(page, '/en/regions/gal');
			await clientNavigate(page, '/en/dishes/tortilla');
			await expectUrl(page, '/en/dishes/tortilla');
			await openBetanzosFromVariations(page, 'en');
			await page.goBack();
			await expectUrl(page, '/en/dishes/tortilla');
			await expectPillWithHref(page, pillHomeLabel('en', 'regional'), '/en/regions/gal');
			await expectPillGoesBack(page, '/en/regions/gal');
		}
	);

	test(
		'reached from the Recipe pill (a deeper page), it is the direct-load pill',
		{ tag: '@cross-browser' },
		async ({ page }) => {
			await gotoHydrated(page, recipePath('en', 'tortilla', 'gal'));
			await expectPillFollowsHref(page, '/en/dishes/tortilla');
			await expectPillWithHref(page, pillHomeLabel('en', 'popular'), popularHome('en'));
			await expectPillFollowsHref(page, popularHome('en'));
		}
	);

	test(
		'crossing 860px swaps the pill and the StickyTopBar, keeping the origin label',
		{ tag: '@layout' },
		async ({ page }) => {
			const desktop = page.viewportSize()!;
			await gotoHydrated(page, '/en/regions/gal');
			await clientNavigate(page, '/en/dishes/tortilla');
			await expectUrl(page, '/en/dishes/tortilla');
			await expectPill(page, pillHomeLabel('en', 'regional'));
			await page.setViewportSize({ width: MOBILE_WIDTH_PX, height: desktop.height });
			await expect(backLink(page, 'en'), 'want the StickyTopBar below 860px').toBeVisible();
			await expect(backPill(page), 'want no pill below 860px').toBeHidden();
			await page.setViewportSize(desktop);
			await expectPillWithHref(page, pillHomeLabel('en', 'regional'), '/en/regions/gal');
			await expect(backLink(page, 'en')).toBeHidden();
		}
	);
});

test.describe('Recipe back pill (desktop)', () => {
	for (const lang of RECIPE_LOCALES) {
		const copy = BETANZOS[lang];
		const betanzos = recipePath(lang, 'tortilla', 'gal');

		test(
			`${lang}: direct load reads "${copy.dish}" and the click opens the Variations page`,
			{ tag: lang === 'en' ? ['@cross-browser'] : [] },
			async ({ page }) => {
				await gotoHydrated(page, betanzos);
				await expectPillWithHref(page, copy.dish, variationsPath(lang, 'tortilla'));
				await expectPillFollowsHref(page, variationsPath(lang, 'tortilla'));
			}
		);

		test(
			`${lang}: from Variations it reads "${copy.dish}"; the click goes back to it`,
			{ tag: lang === 'en' ? ['@cross-browser'] : [] },
			async ({ page }) => {
				await gotoHydrated(page, variationsPath(lang, 'tortilla'));
				await openBetanzosFromVariations(page, lang);
				await expectPillWithHref(page, TORTILLA_PAGE[lang].name, variationsPath(lang, 'tortilla'));
				await expectPillGoesBack(page, variationsPath(lang, 'tortilla'));
			}
		);

		test(
			`${lang}: from Popular it reads "${pillHomeLabel(lang, 'popular')}"; the click returns there`,
			{ tag: lang === 'en' ? ['@cross-browser'] : [] },
			async ({ page }) => {
				await gotoHydrated(page, popularHome(lang));
				await clientNavigate(page, betanzos);
				await expectUrl(page, betanzos);
				await expectPillWithHref(page, pillHomeLabel(lang, 'popular'), popularHome(lang));
				await expectPillGoesBack(page, popularHome(lang));
			}
		);

		test(
			`${lang}: from the Galicia panel it reads "${copy.region}"; the click returns there`,
			{ tag: lang === 'en' ? ['@cross-browser'] : [] },
			async ({ page }) => {
				await gotoHydrated(page, `/${lang}/regions/gal`);
				await regionPanel(page, copy.region).locator(`a[href="${betanzos}"]`).click();
				await expectUrl(page, betanzos);
				await expectPillWithHref(page, copy.region, `/${lang}/regions/gal`);
				await expectPillGoesBack(page, `/${lang}/regions/gal`);
				await expect(regionPanel(page, copy.region)).toBeVisible();
			}
		);
	}

	test(
		'from the Regional home (Andalucía panel) it reads "Andalucía" and returns to /en/',
		{ tag: '@cross-browser' },
		async ({ page }) => {
			const recipe = recipePath('en', 'tortilla', ANDALUCIA_EN.key);
			await gotoHydrated(page, '/en/');
			await regionPanel(page, ANDALUCIA_EN.name).locator(`a[href="${recipe}"]`).click();
			await expectUrl(page, recipe);
			await expectPillWithHref(page, ANDALUCIA_EN.name, '/en/');
			await expectPillGoesBack(page, '/en/');
		}
	);

	test(
		'Popular → Variations → Recipe: the dish pill, then the Popular pill, back to Popular',
		{ tag: '@cross-browser' },
		async ({ page }) => {
			await openTortillaFromPopular(page, 'en', '&f=vegetarian');
			await openBetanzosFromVariations(page, 'en');
			await expectPillWithHref(page, TORTILLA_PAGE.en.name, '/en/dishes/tortilla');
			await expectPillGoesBack(page, '/en/dishes/tortilla');
			await expectPillWithHref(
				page,
				pillHomeLabel('en', 'popular'),
				popularHome('en', '&f=vegetarian')
			);
			await expectPillGoesBack(page, popularHome('en', '&f=vegetarian'));
		}
	);
});

test.describe('Desktop scroll: forward at the top, Back restores', () => {
	test(
		'Popular → Variations → Recipe start at the top; browser Back restores each offset',
		{ tag: '@cross-browser' },
		async ({ page }) => {
			await useShortWindow(page);
			await gotoHydrated(page, popularHome('en'));
			const popularY = await leaveFromCard(page, dishCard(page, 'tortilla'));
			await expectUrl(page, '/en/dishes/tortilla');
			await expectWindowScroll(page, 0, 'the Variations page');
			const variationsY = await leaveFromCard(page, variationCards(page).last());
			await page.waitForURL((u) => /^\/en\/dishes\/tortilla\/[a-z]+$/.test(u.pathname));
			await expectWindowScroll(page, 0, 'the Recipe page');
			await page.goBack();
			await expectUrl(page, '/en/dishes/tortilla');
			await expectWindowScroll(page, variationsY, 'the Variations page after Back');
			await page.goBack();
			await expectUrl(page, popularHome('en'));
			await expectWindowScroll(page, popularY, 'desktop Popular after Back');
		}
	);

	test('the pills restore each offset too', { tag: '@cross-browser' }, async ({ page }) => {
		await useShortWindow(page);
		await gotoHydrated(page, popularHome('en'));
		const popularY = await leaveFromCard(page, dishCard(page, 'tortilla'));
		await expectUrl(page, '/en/dishes/tortilla');
		const variationsY = await leaveFromCard(page, variationCards(page).last());
		await page.waitForURL((u) => /^\/en\/dishes\/tortilla\/[a-z]+$/.test(u.pathname));
		await clickPill(page);
		await expectUrl(page, '/en/dishes/tortilla');
		await expectWindowScroll(page, variationsY, 'the Variations page after its pill');
		await clickPill(page);
		await expectUrl(page, popularHome('en'));
		await expectWindowScroll(page, popularY, 'desktop Popular after the pill');
	});
});

// Scrolls the window until `card` starts at the viewport top (clamped at the
// page end), so it is in view at a non-zero offset, then clicks it. The click
// must not scroll first (Playwright scrolls an off-screen target into view,
// and the offset at the moment the link is followed is what Back restores),
// so the offset is also read in a capture-phase click listener. Returns it.
async function leaveFromCard(page: Page, card: Locator): Promise<number> {
	await card.evaluate((el) => el.scrollIntoView({ block: 'start' }));
	const y = await page.evaluate(() => window.scrollY);
	expect(y, 'want the page scrolled before leaving').toBeGreaterThan(0);
	await page.evaluate(() => {
		const record = () => ((window as unknown as { __clickY: number }).__clickY = window.scrollY);
		document.addEventListener('click', record, { capture: true, once: true });
	});
	await card.click();
	const atClick = await page.evaluate(() => (window as unknown as { __clickY?: number }).__clickY);
	expect(atClick, `got scrollY ${atClick} when the link was followed, want ${y}`).toBe(y);
	return y;
}

test.describe('Desktop: no page-push slide', () => {
	async function walkPopularToRecipeAndBack(page: Page): Promise<string[]> {
		await gotoHydrated(page, popularHome('en'));
		await recordPagePushMarks(page);
		await dishCard(page, 'tortilla').click();
		await expectUrl(page, '/en/dishes/tortilla');
		await openBetanzosFromVariations(page, 'en');
		await page.goBack();
		await expectUrl(page, '/en/dishes/tortilla');
		return pagePushMarks(page);
	}

	const SLIDE_MARKS = ['push', 'pop', 'slide'];

	test(
		'Popular → Variations → Recipe → Back: no slide mark',
		{ tag: '@cross-browser' },
		async ({ page }) => {
			const marks = await walkPopularToRecipeAndBack(page);
			const slides = marks.filter((m) => SLIDE_MARKS.includes(m));
			expect(slides, `got page-push marks ${marks}, want no slide on desktop`).toEqual([]);
		}
	);

	test.describe('under reduced motion', () => {
		test.use({ reducedMotion: 'reduce' });

		test('no slide mark either', { tag: '@cross-browser' }, async ({ page }) => {
			const marks = await walkPopularToRecipeAndBack(page);
			const slides = marks.filter((m) => SLIDE_MARKS.includes(m));
			expect(slides, `got page-push marks ${marks}`).toEqual([]);
		});
	});
});
