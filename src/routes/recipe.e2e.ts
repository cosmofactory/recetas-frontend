import { expect, test, type Page } from '@playwright/test';
import { expectNoViolations } from '../testutil/axe-e2e';
import {
	expectHomeRestored,
	expectUrl,
	leaveScrolledHome,
	LOWEST_DISH
} from '../testutil/home-flow-e2e';
import {
	computedStyle,
	expectSameDocument,
	gotoHydrated,
	markDocument
} from '../testutil/home-e2e';
import { skipOnDesktop } from '../testutil/popular-e2e';
import { historyLength } from '../testutil/region-e2e';
import {
	BETANZOS,
	BETANZOS_STEPS,
	MISSING_PAIR,
	PAELLA_VAL,
	RECIPE_LOCALES,
	RECIPE_TEST_IDS,
	RECIPE_THRESHOLD_PX,
	SERVINGS_MAX,
	SERVINGS_MIN,
	TORTILLA_AST,
	variationsPath,
	type RecipeLocale
} from '../testutil/recipe-copy';
import {
	doneColours,
	clientNavigate,
	expectAnnounced,
	expectBetanzosAt,
	expectRowDone,
	expectRowOpen,
	expectServings,
	fewerButton,
	hitsAround,
	ingredientRows,
	moreButton,
	servingsValue,
	stepRows,
	stepServingsTo
} from '../testutil/recipe-e2e';
import { backFallback, PAGE_COPY, recipePath } from '../testutil/variations-copy';
import {
	backLink,
	expectBar,
	expectBarStuckAtTop,
	scrollWindowTo,
	variationCards,
	waitForPagePushEnd,
	windowScrollY
} from '../testutil/variations-e2e';

// FE-6 PR 3, the mobile Recipe page (5a) end to end (stage FE-6 -> Recipe
// page, Acceptance and Small decisions; mobile README -> Screen 3 and State:
// "recipe: servings, gotIngredients, doneSteps"; "Changing recipe resets
// servings and all ticks; scroll resets to top").
//
// Decisions pinned here (FE-6 PR 3; ids and copy in recipe-copy.ts):
// - The page scrolls the WINDOW; the StickyTopBar's title (the variation
//   name) and hairline appear past 280px (not at 280).
// - Back button: SSR href /:lang/dishes/:dishKey; once hydrated, reached by a
//   forward push from Variations a click is history.back() (Variations comes
//   back with its scroll); on a direct entry it follows the href, and the
//   Variations page reached that way still falls back to home.
// - Stepper: − / + buttons (≥ 44px hit area, extra-strings.json names),
//   range 1–20, disabled at the bounds; the new value is announced by an
//   aria-live="polite" element as "N servings" (ICU plural).
// - Ingredient rows and steps are toggle buttons (aria-pressed). Done: the
//   row keeps opacity 1 (the README's 0.45 fails AA on an operable row,
//   stack.md X10), all its text (name, quantity, step text) is --ink-3, and
//   the check circle is filled with --accent; an ingredient's text is also
//   struck through (a step's is not: README "circle turns accent with ✓").
// - Servings and ticks are component state in memory only (X6): no URL
//   change, no history entry, gone on reload, reset on another recipe
//   (even when SvelteKit reuses the page component), scroll back at the top.
// - Desktop (FE-6 PR 4) shares the content, the 404, the stepper, the ticks
//   and the reset; its pill, layout and sticky card are recipe-desktop.e2e.ts
//   and desktop-navigation.e2e.ts. The StickyTopBar, the mobile sizes and the
//   home flows are mobile only.

const HIT_MIN_PX = 44;
const HIT_REACH_PX = (HIT_MIN_PX - 1) / 2;
const HERO_PX = 220;
const SCROLL_PAST_END_PX = 100_000;
const SCROLL_TOLERANCE_PX = 1;
const BETANZOS_EN = recipePath('en', 'tortilla', 'gal');
const PAELLA_EN = recipePath('en', PAELLA_VAL.dishKey, PAELLA_VAL.regionKey);

const MOBILE_ONLY = 'the mobile Recipe layout (< 860px)';
const skipMobileOnly = ({ page }: { page: Page }) => skipOnDesktop(page, MOBILE_ONLY);

const betanzosPath = (lang: RecipeLocale) => recipePath(lang, 'tortilla', 'gal');

async function scrollToEnd(page: Page): Promise<number> {
	const y = await scrollWindowTo(page, SCROLL_PAST_END_PX);
	expect(y, 'want the page to scroll').toBeGreaterThan(0);
	return y;
}

async function expectNothingTicked(page: Page) {
	const pressed = page.locator(
		`[data-testid="${RECIPE_TEST_IDS.ingredient}"][aria-pressed="true"], [data-testid="${RECIPE_TEST_IDS.step}"][aria-pressed="true"]`
	);
	await expect(pressed, 'want every tick cleared').toHaveCount(0);
}

// Servings 5, the first ingredient and the second step ticked.
async function tickAndScale(page: Page) {
	await stepServingsTo(page, 'en', BETANZOS.en.baseServings, 5);
	await ingredientRows(page).first().click();
	await stepRows(page).nth(1).click();
	await expect(ingredientRows(page).first()).toHaveAttribute('aria-pressed', 'true');
	await expect(stepRows(page).nth(1)).toHaveAttribute('aria-pressed', 'true');
}

test.describe('Recipe page without JavaScript', () => {
	test.use({ javaScriptEnabled: false });

	for (const lang of RECIPE_LOCALES) {
		const copy = BETANZOS[lang];
		const url = betanzosPath(lang);

		test(`${url}: eyebrow, name, description, time, servings at the base`, async ({ page }) => {
			const res = await page.goto(url);
			expect(res?.status()).toBe(200);
			await expect(page.getByTestId(RECIPE_TEST_IDS.eyebrow)).toHaveText(
				`${copy.region} · ${copy.dish}`
			);
			await expect(page.getByRole('heading', { level: 1 })).toHaveText(copy.name);
			await expect(page.getByText(copy.description, { exact: true })).toBeVisible();
			await expect(page.getByTestId(RECIPE_TEST_IDS.time)).toHaveText(copy.time);
			await expectServings(page, copy.baseServings);
		});

		test(`${url}: every ingredient at the base servings, every step numbered`, async ({ page }) => {
			await page.goto(url);
			await expectBetanzosAt(page, lang, 2);
			const steps = BETANZOS_STEPS[lang];
			await expect(stepRows(page)).toHaveCount(steps.count);
			await expect(stepRows(page).first()).toContainText(steps.first);
			await expect(stepRows(page).first()).toContainText('1');
			await expect(stepRows(page).last()).toContainText(steps.last);
			await expect(stepRows(page).last()).toContainText(String(steps.count));
		});

		test(`${url}: the back link goes to ${variationsPath(lang, 'tortilla')}`, async ({ page }) => {
			skipOnDesktop(page, MOBILE_ONLY);
			await page.goto(url);
			await expect(backLink(page, lang)).toHaveAttribute('href', variationsPath(lang, 'tortilla'));
		});
	}

	test(
		`hero photo ${HERO_PX}px; the eyebrow is upper-cased by CSS`,
		{ tag: '@layout' },
		async ({ page }) => {
			skipOnDesktop(page, MOBILE_ONLY);
			await page.goto(BETANZOS_EN);
			// No MEDIA_BASE_URL in E2E: the hero <Photo> is its placeholder box.
			const hero = await page.locator('.placeholder').first().boundingBox();
			expect(hero?.height, 'got no hero box').toBe(HERO_PX);
			const eyebrow = page.getByTestId(RECIPE_TEST_IDS.eyebrow);
			expect((await computedStyle(eyebrow, ['text-transform']))['text-transform']).toBe(
				'uppercase'
			);
		}
	);

	test('the controls do nothing: + leaves 2 servings and the base quantities', async ({ page }) => {
		await page.goto(BETANZOS_EN);
		await moreButton(page, 'en').click();
		await ingredientRows(page).first().click();
		await expectServings(page, 2);
		await expectBetanzosAt(page, 'en', 2);
	});
});

test.describe('Recipe page: unknown dish or region', () => {
	for (const lang of RECIPE_LOCALES) {
		const paths = [
			`/${lang}/dishes/nope/gal`,
			`/${lang}/dishes/tortilla/nope`,
			recipePath(lang, MISSING_PAIR.dishKey, MISSING_PAIR.regionKey)
		];
		for (const path of paths) {
			test(`${path} is a 404 in ${lang}`, async ({ page }) => {
				const res = await page.goto(path);
				expect(res?.status(), `got ${res?.status()}, want 404`).toBe(404);
				await expect(page.locator('html')).toHaveAttribute('lang', lang);
				await expect(page.locator('h1')).toHaveText(PAGE_COPY[lang].notFoundTitle);
			});
		}
	}
});

test.describe('Recipe page: servings stepper', () => {
	for (const lang of RECIPE_LOCALES) {
		test(`${lang}: 2 → 5 on the Betanzos recipe rescales every quantity and announces 5`, async ({
			page
		}) => {
			await gotoHydrated(page, betanzosPath(lang));
			await expectServings(page, 2);
			await stepServingsTo(page, lang, 2, 5);
			await expectBetanzosAt(page, lang, 5);
			await expectAnnounced(page, lang, 5);
		});

		test(`${lang}: down to ${SERVINGS_MIN}: − disabled, quantities at 1, announced`, async ({
			page
		}) => {
			await gotoHydrated(page, betanzosPath(lang));
			await stepServingsTo(page, lang, 2, SERVINGS_MIN);
			await expect(fewerButton(page, lang)).toBeDisabled();
			await expect(moreButton(page, lang)).toBeEnabled();
			await expectBetanzosAt(page, lang, SERVINGS_MIN);
			await expectAnnounced(page, lang, SERVINGS_MIN);
		});

		test(`${lang}: up to ${SERVINGS_MAX}: + disabled, quantities at 20, announced`, async ({
			page
		}) => {
			await gotoHydrated(page, betanzosPath(lang));
			await stepServingsTo(page, lang, 2, SERVINGS_MAX);
			await expect(moreButton(page, lang)).toBeDisabled();
			await expect(fewerButton(page, lang)).toBeEnabled();
			await expectBetanzosAt(page, lang, SERVINGS_MAX);
			await expectAnnounced(page, lang, SERVINGS_MAX);
		});
	}

	test('the bounds hold: − at 1 and + at 20 change nothing', async ({ page }) => {
		await gotoHydrated(page, BETANZOS_EN);
		await stepServingsTo(page, 'en', 2, SERVINGS_MIN);
		await fewerButton(page, 'en').click({ force: true });
		await expectServings(page, SERVINGS_MIN);
		await stepServingsTo(page, 'en', SERVINGS_MIN, SERVINGS_MAX);
		await moreButton(page, 'en').click({ force: true });
		await expectServings(page, SERVINGS_MAX);
	});

	test('the keyboard works the stepper (Enter and Space)', async ({ page }) => {
		await gotoHydrated(page, BETANZOS_EN);
		await moreButton(page, 'en').focus();
		await page.keyboard.press('Enter');
		await page.keyboard.press('Space');
		await expectServings(page, 4);
	});

	test(
		`− and + each answer hits over ${HIT_MIN_PX}px, on both axes`,
		{ tag: '@layout' },
		async ({ page }) => {
			await gotoHydrated(page, BETANZOS_EN);
			for (const [name, button] of [
				['−', fewerButton(page, 'en')],
				['+', moreButton(page, 'en')]
			] as const) {
				const hits = await hitsAround(button, HIT_REACH_PX);
				expect(hits, `want ${name} hit ${HIT_REACH_PX}px around its centre`).toBe(true);
			}
		}
	);

	test('changing servings adds no history entry and leaves the URL alone', async ({ page }) => {
		await gotoHydrated(page, BETANZOS_EN);
		const entries = await historyLength(page);
		await stepServingsTo(page, 'en', 2, 5);
		expect(new URL(page.url()).pathname + new URL(page.url()).search).toBe(BETANZOS_EN);
		expect(await historyLength(page)).toBe(entries);
	});
});

test.describe('Recipe page: ingredient and step ticks', () => {
	test('an ingredient toggles: pressed, struck through, --ink-3 text, accent check; and back', async ({
		page
	}) => {
		await gotoHydrated(page, BETANZOS_EN);
		const colours = await doneColours(page);
		const row = ingredientRows(page).nth(1);
		await expectRowOpen(row, colours);
		await row.click();
		await expectRowDone(row, colours, true);
		await row.click();
		await expectRowOpen(row, colours);
	});

	test('a step toggles: pressed, --ink-3 text, accent circle (not struck through); and back', async ({
		page
	}) => {
		await gotoHydrated(page, BETANZOS_EN);
		const colours = await doneColours(page);
		const step = stepRows(page).nth(2);
		await expectRowOpen(step, colours);
		await step.click();
		await expectRowDone(step, colours, false);
		await step.click();
		await expectRowOpen(step, colours);
	});

	test('ticks are independent: one row toggles only itself', async ({ page }) => {
		await gotoHydrated(page, BETANZOS_EN);
		await ingredientRows(page).first().click();
		await stepRows(page).first().click();
		const pressed = async () => [
			...(await ingredientRows(page).evaluateAll((r) =>
				r.map((e) => e.getAttribute('aria-pressed'))
			)),
			...(await stepRows(page).evaluateAll((r) => r.map((e) => e.getAttribute('aria-pressed'))))
		];
		await expect
			.poll(pressed)
			.toEqual(['true', 'false', 'false', 'false', 'true', 'false', 'false', 'false', 'false']);
	});

	test('rows toggle from the keyboard (Space on an ingredient, Enter on a step)', async ({
		page
	}) => {
		await gotoHydrated(page, BETANZOS_EN);
		await ingredientRows(page).first().focus();
		await page.keyboard.press('Space');
		await stepRows(page).first().focus();
		await page.keyboard.press('Enter');
		await expect(ingredientRows(page).first()).toHaveAttribute('aria-pressed', 'true');
		await expect(stepRows(page).first()).toHaveAttribute('aria-pressed', 'true');
	});

	test('a ticked ingredient keeps its tick and gets its new quantity when servings change', async ({
		page
	}) => {
		await gotoHydrated(page, BETANZOS_EN);
		await ingredientRows(page).first().click();
		await stepServingsTo(page, 'en', 2, 5);
		await expect(ingredientRows(page).first()).toHaveAttribute('aria-pressed', 'true');
		await expectBetanzosAt(page, 'en', 5);
	});

	test('memory only: no URL change or history entry, and a reload clears everything', async ({
		page
	}) => {
		await gotoHydrated(page, BETANZOS_EN);
		const entries = await historyLength(page);
		await tickAndScale(page);
		expect(new URL(page.url()).pathname + new URL(page.url()).search).toBe(BETANZOS_EN);
		expect(await historyLength(page)).toBe(entries);
		await page.reload({ waitUntil: 'networkidle' });
		await expectServings(page, 2);
		await expectNothingTicked(page);
		await expectBetanzosAt(page, 'en', 2);
	});
});

test.describe('Recipe page: another recipe starts fresh', () => {
	test(
		'a client navigation to another recipe resets servings and ticks, at the top',
		{ tag: '@cross-browser' },
		async ({ page }) => {
			await gotoHydrated(page, BETANZOS_EN);
			await markDocument(page);
			await tickAndScale(page);
			await scrollToEnd(page);
			await clientNavigate(page, recipePath('en', 'tortilla', TORTILLA_AST.regionKey));
			await expectUrl(page, recipePath('en', 'tortilla', TORTILLA_AST.regionKey));
			await expect(page.getByRole('heading', { level: 1 })).toHaveText(TORTILLA_AST.name);
			await expectSameDocument(page, 'to another recipe');
			await expectServings(page, TORTILLA_AST.baseServings);
			await expectNothingTicked(page);
			await expect.poll(() => windowScrollY(page), { message: 'want the top' }).toBe(0);
		}
	);

	test(
		'Back to Variations and into another card: base servings, nothing ticked',
		{ tag: '@cross-browser' },
		async ({ page }) => {
			await gotoHydrated(page, variationsPath('en', 'tortilla'));
			await variationCards(page).first().click();
			await expectUrl(page, BETANZOS_EN);
			await waitForPagePushEnd(page);
			await tickAndScale(page);
			await page.goBack();
			await expectUrl(page, variationsPath('en', 'tortilla'));
			await variationCards(page).nth(1).click();
			await expectUrl(page, recipePath('en', 'tortilla', TORTILLA_AST.regionKey));
			await waitForPagePushEnd(page);
			await expectServings(page, TORTILLA_AST.baseServings);
			await expectNothingTicked(page);
			expect(await windowScrollY(page), 'want the top').toBe(0);
		}
	);

	test('the same recipe opened again from Variations starts fresh too', async ({ page }) => {
		skipOnDesktop(page, MOBILE_ONLY);
		await gotoHydrated(page, variationsPath('en', 'tortilla'));
		await variationCards(page).first().click();
		await expectUrl(page, BETANZOS_EN);
		await waitForPagePushEnd(page);
		await tickAndScale(page);
		await backLink(page, 'en').click();
		await expectUrl(page, variationsPath('en', 'tortilla'));
		await variationCards(page).first().click();
		await expectUrl(page, BETANZOS_EN);
		await waitForPagePushEnd(page);
		await expectServings(page, 2);
		await expectNothingTicked(page);
	});
});

test.describe('Recipe page: sticky top bar on window scroll', () => {
	test.beforeEach(skipMobileOnly);

	for (const lang of RECIPE_LOCALES) {
		const url = recipePath(lang, PAELLA_VAL.dishKey, PAELLA_VAL.regionKey);

		// Sticky is an engine check too, once per engine (en).
		const tag = lang === 'en' ? ['@layout', '@cross-browser'] : ['@layout'];
		test(
			`${url}: the title appears past ${RECIPE_THRESHOLD_PX}px, not at it; the bar stays stuck`,
			{ tag },
			async ({ page }) => {
				await gotoHydrated(page, url);
				await expectBar(page, lang, PAELLA_VAL.name, false);
				expect(await scrollWindowTo(page, RECIPE_THRESHOLD_PX)).toBe(RECIPE_THRESHOLD_PX);
				await expectBar(page, lang, PAELLA_VAL.name, false);
				expect(await scrollWindowTo(page, RECIPE_THRESHOLD_PX + 1)).toBe(RECIPE_THRESHOLD_PX + 1);
				await expectBar(page, lang, PAELLA_VAL.name, true);
				await scrollToEnd(page);
				await expectBarStuckAtTop(page, lang);
				await scrollWindowTo(page, 0);
				await expectBar(page, lang, PAELLA_VAL.name, false);
			}
		);
	}

	test(
		'after the page push from Variations: starts at the top',
		{ tag: '@cross-browser' },
		async ({ page }) => {
			await gotoHydrated(page, variationsPath('en', 'tortilla'));
			await scrollWindowTo(page, SCROLL_PAST_END_PX);
			await variationCards(page).last().click();
			await page.waitForURL((u) => /^\/en\/dishes\/tortilla\/[a-z]+$/.test(u.pathname));
			await waitForPagePushEnd(page);
			expect(await windowScrollY(page), 'want the recipe to start at the top').toBe(0);
		}
	);
});

test.describe('Recipe page: back button', () => {
	test.beforeEach(skipMobileOnly);

	for (const lang of RECIPE_LOCALES) {
		// One locale per engine: history doesn't change with the language.
		const tag = lang === 'en' ? ['@cross-browser'] : [];
		test(
			`${lang}: on a direct entry it goes to ${variationsPath(lang, 'tortilla')}`,
			{ tag },
			async ({ page }) => {
				await gotoHydrated(page, betanzosPath(lang));
				const entries = await historyLength(page);
				await backLink(page, lang).click();
				await expectUrl(page, variationsPath(lang, 'tortilla'));
				expect(await historyLength(page), 'want a new entry (the href)').toBe(entries + 1);
			}
		);
	}

	test(
		'from Variations it goes back in history, Variations scroll restored',
		{ tag: '@cross-browser' },
		async ({ page }) => {
			await gotoHydrated(page, variationsPath('en', 'tortilla'));
			const card = variationCards(page).nth(3);
			await card.scrollIntoViewIfNeeded();
			const offset = await windowScrollY(page);
			expect(offset, 'want the Variations page scrolled before leaving').toBeGreaterThan(0);
			await markDocument(page);
			await card.click();
			await page.waitForURL((u) => /^\/en\/dishes\/tortilla\/[a-z]+$/.test(u.pathname));
			await waitForPagePushEnd(page);
			const entries = await historyLength(page);
			await backLink(page, 'en').click();
			await expectUrl(page, variationsPath('en', 'tortilla'));
			expect(await historyLength(page), 'want history.back(), not a new entry').toBe(entries);
			await expectSameDocument(page, 'back from the Recipe page');
			await expect
				.poll(async () => Math.abs((await windowScrollY(page)) - offset), {
					message: `want the Variations page back at ${offset}px`
				})
				.toBeLessThanOrEqual(SCROLL_TOLERANCE_PX);
		}
	);

	test(
		'direct entry → its back link → Variations back goes home, not into the Recipe',
		{ tag: '@cross-browser' },
		async ({ page }) => {
			await gotoHydrated(page, BETANZOS_EN);
			await backLink(page, 'en').click();
			await expectUrl(page, variationsPath('en', 'tortilla'));
			await waitForPagePushEnd(page);
			await backLink(page, 'en').click();
			await expectUrl(page, backFallback('en', 'tortilla'));
		}
	);
});

test.describe('Acceptance: home → Variations → Recipe → back → back', () => {
	test.beforeEach(skipMobileOnly);

	const recipeOfLowest = new RegExp(`^/en/dishes/${LOWEST_DISH}/[a-z]+$`);

	async function intoRecipe(page: Page) {
		await variationCards(page).first().click();
		await page.waitForURL((u) => recipeOfLowest.test(u.pathname));
		await waitForPagePushEnd(page);
		await moreButton(page, 'en').click();
		await ingredientRows(page).first().click();
	}

	test(
		'the back buttons return the exact home: tab, filters, sheet, list scroll',
		{ tag: '@cross-browser' },
		async ({ page }) => {
			const home = await leaveScrolledHome(page);
			await intoRecipe(page);
			await backLink(page, 'en').click();
			await expectUrl(page, variationsPath('en', LOWEST_DISH));
			await waitForPagePushEnd(page);
			await backLink(page, 'en').click();
			await expectHomeRestored(page, home);
		}
	);

	test('browser Back twice does the same', { tag: '@cross-browser' }, async ({ page }) => {
		const home = await leaveScrolledHome(page);
		await intoRecipe(page);
		await page.goBack();
		await expectUrl(page, variationsPath('en', LOWEST_DISH));
		await page.goBack();
		await expectHomeRestored(page, home);
	});
});

test.describe('axe: WCAG 2.2 AA on the Recipe page', () => {
	test.beforeEach(skipMobileOnly);

	for (const lang of RECIPE_LOCALES) {
		const url = betanzosPath(lang);

		// stack.md F4: one axe pass per engine (en).
		const tag = lang === 'en' ? ['@cross-browser'] : [];
		test(`${url} has no violations`, { tag }, async ({ page }) => {
			await gotoHydrated(page, url);
			await expect(servingsValue(page)).toBeVisible();
			await expectNoViolations(page, url);
		});

		test(`${url} with ticks, servings at ${SERVINGS_MIN} and scrolled has no violations`, async ({
			page
		}) => {
			await gotoHydrated(page, url);
			await stepServingsTo(page, lang, 2, SERVINGS_MIN);
			await ingredientRows(page).first().click();
			await stepRows(page).first().click();
			await expect(stepRows(page).first()).toHaveAttribute('aria-pressed', 'true');
			await scrollToEnd(page);
			await expectNoViolations(page, `${url} (ticked, scrolled)`);
		});
	}

	test(`${PAELLA_EN} past the bar threshold, + disabled at ${SERVINGS_MAX}, has no violations`, async ({
		page
	}) => {
		await gotoHydrated(page, PAELLA_EN);
		await stepServingsTo(page, 'en', 4, SERVINGS_MAX);
		await scrollToEnd(page);
		await expectBar(page, 'en', PAELLA_VAL.name, true);
		await expectNoViolations(page, `${PAELLA_EN} (scrolled, at ${SERVINGS_MAX})`);
	});
});
