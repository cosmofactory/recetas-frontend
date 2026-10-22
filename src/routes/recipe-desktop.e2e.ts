import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { expectNoViolations } from '../testutil/axe-e2e';
import {
	backPill,
	columnOf,
	contentBox,
	expectPill,
	expectPillWithHref,
	gridAround,
	expectIngredientsCard,
	ingredientsCard,
	maxWindowScroll,
	MOBILE_WIDTH_PX,
	visiblePhoto
} from '../testutil/desktop-pages-e2e';
import { boxOf, computedStyle, expectPx, gotoHydrated, tokenValue } from '../testutil/home-e2e';
import { skipOnMobile } from '../testutil/popular-e2e';
import {
	BETANZOS,
	BETANZOS_STEPS,
	RECIPE_LOCALES,
	RECIPE_TEST_IDS,
	variationsPath,
	type RecipeLocale
} from '../testutil/recipe-copy';
import {
	expectBetanzosAt,
	expectServings,
	fewerButton,
	ingredientRows,
	moreButton,
	stepRows,
	stepServingsTo
} from '../testutil/recipe-e2e';
import { recipePath } from '../testutil/variations-copy';
import { backLink, scrollWindowTo } from '../testutil/variations-e2e';

// FE-6 PR 4, the desktop (≥ 860px) Recipe page: layout metrics, the sticky
// ingredients card, the server-rendered back pill and the 860px crossing.
// Tiered matrix (stack.md F4): the core projects run every test; geometry
// is @layout (also 860×800 and 1440×900), engine behaviour @cross-browser
// (WebKit 1440, Firefox 1280), axe once per desktop engine.
// The acceptance "layouts match the prototype at 1280×800 and 1440×900" is
// covered by the @layout metrics at both sizes, not by pixel snapshots. Scaling and ticks are the shared recipe.e2e.ts specs, which
// now run on desktop too.
//
// Sources:
// - Desktop README -> Layout & screens -> Recipe page: "Hero grid 1fr/1.1fr:
//   eyebrow "Region · Dish", title 56px serif, description 17px, Time /
//   Serves strip (stepper buttons 34px) | 380px photo. Body grid
//   minmax(300px,380px) 1fr: ingredients card is sticky (top 24px) while the
//   method scrolls; steps use 42px number circles and 18px text (lh 1.6, max
//   640px). Same tick-off behaviour and quantity scaling as mobile."
// - Desktop prototype L208–255 (wins over the README): the title's lh is 1;
//   the hero tracks are minmax(0,1fr) minmax(0,1.1fr); the strip sits under
//   the description; the body grid is align-items: start.
// - Stage FE-6 -> Acceptance: "The ingredients card stays visible while the
//   method scrolls at 1280×800."
//
// Decisions pinned here (FE-6 PR 4):
// - The window scrolls on desktop, as on desktop Popular: the card sticks
//   24px under the viewport top, bounded by the body grid (plain CSS sticky).
// - ONE RecipeBody: crossing 860px swaps the StickyTopBar and the pill but
//   keeps the servings and ticks (both live in that one component).

const HERO_PHOTO_PX = 380;
const HERO_SECOND_TRACK_RATIO = 1.1;
const TITLE_PX = 56;
const TITLE_LINE_HEIGHT = 1;
const DESCRIPTION_PX = 17;
const STEPPER_BUTTON_PX = 34;
const INGREDIENTS_TRACK_PX = 380;
const STICKY_TOP_PX = 24;
const STEP_CIRCLE_PX = 42;
const STEP_TEXT_PX = 18;
const STEP_TEXT_LINE_HEIGHT = 1.6;
const STEP_TEXT_MAX_WIDTH_PX = 640;
const ACCEPTANCE_VIEWPORT = { width: 1280, height: 800 };
// Short enough that the Betanzos method outgrows the card at every width.
const STICKY_VIEWPORT_HEIGHT_PX = 420;
const SCROLL_SAMPLES = [0, 0.25, 0.5, 0.75, 1];
const RATIO_TOLERANCE = 0.01;
const BETANZOS_EN = recipePath('en', 'tortilla', 'gal');

const title = (page: Page) => page.getByRole('heading', { level: 1 });
const betanzosPath = (lang: RecipeLocale) => recipePath(lang, 'tortilla', 'gal');

async function openRecipe(page: Page, url = BETANZOS_EN) {
	await gotoHydrated(page, url);
	await expect(title(page)).toBeVisible();
}

test.describe('Recipe (desktop): hero grid', () => {
	test.beforeEach(({ page }) => skipOnMobile(page, 'the desktop Recipe layout (≥ 860px)'));

	test(
		'1fr | 1.1fr in the page container: the text column, then the 380px photo',
		{ tag: '@layout' },
		async ({ page }) => {
			await openRecipe(page);
			const grid = await gridAround(title(page), 'the title');
			const want = await contentBox(page);
			expectPx(grid.box.x, want.x, 'hero grid x');
			expectPx(grid.box.width, want.width, 'hero grid width');
			expect(grid.tracks.length, `got tracks ${grid.tracks}, want 2`).toBe(2);
			const ratio = grid.tracks[1] / grid.tracks[0];
			expect(Math.abs(ratio - HERO_SECOND_TRACK_RATIO), `got track ratio ${ratio}`).toBeLessThan(
				RATIO_TOLERANCE
			);
			const photo = await boxOf(visiblePhoto(page.locator('main')), 'the hero photo');
			expect(columnOf(grid, await boxOf(title(page), 'the title')), 'title column').toBe(0);
			expect(columnOf(grid, photo), 'want the photo in the second column').toBe(1);
			expectPx(photo.height, HERO_PHOTO_PX, 'hero photo height');
			expectPx(photo.width, grid.tracks[1], 'hero photo width (fills its column)');
		}
	);

	test(
		'eyebrow, 56px serif title, 17px description, then the strip, in that order',
		{ tag: '@layout' },
		async ({ page }) => {
			await openRecipe(page);
			const copy = BETANZOS.en;
			const eyebrow = page.getByTestId(RECIPE_TEST_IDS.eyebrow);
			await expect(eyebrow).toHaveText(`${copy.region} · ${copy.dish}`);
			const style = await computedStyle(title(page), ['font-size', 'line-height', 'font-family']);
			expect(style['font-size']).toBe(`${TITLE_PX}px`);
			expectPx(parseFloat(style['line-height']), TITLE_PX * TITLE_LINE_HEIGHT, 'title line-height');
			expect(style['font-family']).toBe(
				await tokenValue(page, 'font-family', 'var(--font-display)')
			);
			const description = page.getByText(copy.description, { exact: true });
			expect((await computedStyle(description, ['font-size']))['font-size']).toBe(
				`${DESCRIPTION_PX}px`
			);
			const order = [
				await boxOf(eyebrow, 'the eyebrow'),
				await boxOf(title(page), 'the title'),
				await boxOf(description, 'the description'),
				await boxOf(page.getByTestId(RECIPE_TEST_IDS.time), 'the time')
			];
			for (let i = 1; i < order.length; i++) {
				expect(order[i].y, `want part ${i} below part ${i - 1}`).toBeGreaterThanOrEqual(
					order[i - 1].y + order[i - 1].height - 1
				);
			}
		}
	);

	test(
		'the stepper buttons are 34px circles in the text column',
		{ tag: '@layout' },
		async ({ page }) => {
			await openRecipe(page);
			const grid = await gridAround(title(page), 'the title');
			for (const [name, button] of [
				['−', fewerButton(page, 'en')],
				['+', moreButton(page, 'en')]
			] as const) {
				const box = await boxOf(button, name);
				expectPx(box.width, STEPPER_BUTTON_PX, `${name} width`);
				expectPx(box.height, STEPPER_BUTTON_PX, `${name} height`);
				expect(columnOf(grid, box), `want ${name} in the text column`).toBe(0);
			}
		}
	);

	test('the back pill comes first; no sticky top bar', { tag: '@layout' }, async ({ page }) => {
		await openRecipe(page);
		await expect(backPill(page), 'want the desktop back pill').toBeVisible();
		const pill = await boxOf(backPill(page), 'the back pill');
		const grid = await gridAround(title(page), 'the title');
		expect(pill.y + pill.height, 'want the pill above the hero').toBeLessThanOrEqual(grid.box.y);
		await expect(backLink(page, 'en'), 'want no StickyTopBar back button').toBeHidden();
	});
});

test.describe('Recipe (desktop): body grid and steps', () => {
	test.beforeEach(({ page }) => skipOnMobile(page, 'the desktop Recipe layout (≥ 860px)'));

	test(
		'minmax(300px, 380px) | 1fr: the ingredients card, then the method',
		{ tag: '@layout' },
		async ({ page }) => {
			await openRecipe(page);
			const card = ingredientsCard(page);
			await expectIngredientsCard(page);
			await expect(card.getByTestId(RECIPE_TEST_IDS.ingredient)).toHaveCount(4);
			const grid = await gridAround(card, 'the ingredients card');
			const want = await contentBox(page);
			expectPx(grid.box.x, want.x, 'body grid x');
			expectPx(grid.box.width, want.width, 'body grid width');
			expect(grid.tracks.length, `got tracks ${grid.tracks}, want 2`).toBe(2);
			expectPx(grid.tracks[0], INGREDIENTS_TRACK_PX, 'ingredients track (room for its 380px max)');
			expect(columnOf(grid, await boxOf(card, 'the card')), 'card column').toBe(0);
			const step = await boxOf(stepRows(page).first(), 'the first step');
			expect(columnOf(grid, step), 'want the method in the second column').toBe(1);
		}
	);

	test(
		'the ingredients card is position: sticky, top 24px',
		{ tag: ['@layout', '@cross-browser'] },
		async ({ page }) => {
			await openRecipe(page);
			await expectIngredientsCard(page);
			const got = await computedStyle(ingredientsCard(page), ['position', 'top']);
			expect(got).toEqual({ position: 'sticky', top: `${STICKY_TOP_PX}px` });
		}
	);

	test(
		'steps: 42px number circles, 18px text, lh 1.6, max-width 640px',
		{ tag: '@layout' },
		async ({ page }) => {
			await openRecipe(page);
			const step = stepRows(page).first();
			const circle = await boxOf(step.getByTestId(RECIPE_TEST_IDS.check), 'the number circle');
			expectPx(circle.width, STEP_CIRCLE_PX, 'circle width');
			expectPx(circle.height, STEP_CIRCLE_PX, 'circle height');
			const text = step.getByText(BETANZOS_STEPS.en.first, { exact: true });
			const style = await computedStyle(text, ['font-size', 'line-height', 'max-width']);
			expect(style['font-size']).toBe(`${STEP_TEXT_PX}px`);
			expectPx(parseFloat(style['line-height']), STEP_TEXT_PX * STEP_TEXT_LINE_HEIGHT, 'step lh');
			expect(style['max-width']).toBe(`${STEP_TEXT_MAX_WIDTH_PX}px`);
		}
	);
});

type StickyStart = { cardTop: number; cardHeight: number; areaBottom: number };

// Where the card and the bottom of its grid area are with the window at the top.
async function stickyStart(page: Page): Promise<StickyStart> {
	await expectIngredientsCard(page);
	await scrollWindowTo(page, 0);
	const card = await boxOf(ingredientsCard(page), 'the ingredients card');
	const grid = await gridAround(ingredientsCard(page), 'the ingredients card');
	return {
		cardTop: card.y,
		cardHeight: card.height,
		areaBottom: grid.box.y + grid.box.height
	};
}

// CSS sticky in a window-scrolled page: the card follows the page until it
// is 24px under the viewport top, then stays there until its grid area ends.
function stuckTop(start: StickyStart, scrollY: number): number {
	const natural = start.cardTop - scrollY;
	const areaLimit = start.areaBottom - scrollY - start.cardHeight;
	return Math.min(Math.max(STICKY_TOP_PX, natural), areaLimit);
}

async function cardTopAt(page: Page, y: number): Promise<number> {
	const got = await scrollWindowTo(page, y);
	expectPx(got, y, 'window scrollY', 1);
	return (await boxOf(ingredientsCard(page), 'the ingredients card')).y;
}

test.describe('Recipe (desktop): the ingredients card sticks while the method scrolls', () => {
	test.beforeEach(({ page }) => skipOnMobile(page, 'the desktop Recipe layout (≥ 860px)'));

	test(
		'on a short window the card stays 24px under the top, within the body grid',
		{ tag: ['@layout', '@cross-browser'] },
		async ({ page }) => {
			const width = page.viewportSize()!.width;
			await page.setViewportSize({ width, height: STICKY_VIEWPORT_HEIGHT_PX });
			await openRecipe(page);
			const start = await stickyStart(page);
			const max = Math.floor(await maxWindowScroll(page));
			expect(max, 'want the window to scroll the card past its sticky top').toBeGreaterThan(
				start.cardTop - STICKY_TOP_PX
			);
			for (const share of SCROLL_SAMPLES) {
				const y = Math.round(share * max);
				expectPx(await cardTopAt(page, y), stuckTop(start, y), `card top at scrollY ${y}`, 1);
			}
			const stuckAt = Math.ceil(start.cardTop - STICKY_TOP_PX) + 1;
			expectPx(await cardTopAt(page, stuckAt), STICKY_TOP_PX, 'card top once stuck', 1);
		}
	);

	test(
		'acceptance at 1280×800: the whole card stays in view as the method scrolls',
		{ tag: '@cross-browser' },
		async ({ page }) => {
			await page.setViewportSize(ACCEPTANCE_VIEWPORT);
			await openRecipe(page);
			await expectIngredientsCard(page);
			const max = Math.floor(await maxWindowScroll(page));
			expect(max, 'want the Betanzos page to scroll at 1280×800').toBeGreaterThan(0);
			for (const share of SCROLL_SAMPLES.slice(1)) {
				const y = Math.round(share * max);
				const top = await cardTopAt(page, y);
				const card = await boxOf(ingredientsCard(page), 'the ingredients card');
				expect(top, `card top at scrollY ${y}`).toBeGreaterThanOrEqual(STICKY_TOP_PX - 1);
				expect(card.y + card.height, `card bottom at scrollY ${y}`).toBeLessThanOrEqual(
					ACCEPTANCE_VIEWPORT.height
				);
			}
		}
	);
});

test.describe('Recipe (desktop): crossing 860px', () => {
	test.beforeEach(({ page }) => skipOnMobile(page, 'starts on a desktop window'));

	test(
		'swaps the pill for the StickyTopBar and back, keeping servings and ticks',
		{ tag: '@layout' },
		async ({ page }) => {
			const desktop = page.viewportSize()!;
			await openRecipe(page);
			await stepServingsTo(page, 'en', BETANZOS.en.baseServings, 5);
			await ingredientRows(page).first().click();
			await stepRows(page).nth(1).click();
			await page.setViewportSize({ width: MOBILE_WIDTH_PX, height: desktop.height });
			await expect(backLink(page, 'en'), 'want the StickyTopBar below 860px').toBeVisible();
			await expect(backPill(page), 'want no pill below 860px').toBeHidden();
			await expectKeptState(page);
			await page.setViewportSize(desktop);
			await expectPill(page, BETANZOS.en.dish);
			await expect(backLink(page, 'en')).toBeHidden();
			await expectKeptState(page);
		}
	);
});

async function expectKeptState(page: Page) {
	await expectServings(page, 5);
	await expectBetanzosAt(page, 'en', 5);
	await expect(ingredientRows(page).first()).toHaveAttribute('aria-pressed', 'true');
	await expect(stepRows(page).nth(1)).toHaveAttribute('aria-pressed', 'true');
}

test.describe('Recipe (desktop) without JavaScript', () => {
	test.use({ javaScriptEnabled: false });
	test.beforeEach(({ page }) => skipOnMobile(page, 'the desktop Recipe layout (≥ 860px)'));

	for (const lang of RECIPE_LOCALES) {
		const dish = BETANZOS[lang].dish;

		test(`${betanzosPath(lang)}: the pill reads "${dish}" and goes to the Variations page`, async ({
			page
		}) => {
			await page.goto(betanzosPath(lang));
			await expectPillWithHref(page, dish, variationsPath(lang, 'tortilla'));
			await expect(backLink(page, lang), 'want no StickyTopBar back button').toBeHidden();
			await expectBetanzosAt(page, lang, 2);
		});
	}
});

// Every desktop engine; the other Chromium widths add nothing to axe.
const AXE_PROJECTS = ['chromium-desktop-1280', 'firefox-desktop-1280', 'webkit-desktop-1440'];

function onlyInAxeProject(testInfo: TestInfo) {
	test.skip(
		!AXE_PROJECTS.includes(testInfo.project.name),
		`axe runs in ${AXE_PROJECTS.join(', ')}`
	);
}

test.describe('axe: WCAG 2.2 AA on the desktop Recipe page', () => {
	for (const lang of RECIPE_LOCALES) {
		const url = betanzosPath(lang);

		test(
			`${url} has no violations`,
			{ tag: lang === 'en' ? ['@cross-browser'] : [] },
			async ({ page }, testInfo) => {
				onlyInAxeProject(testInfo);
				await openRecipe(page, url);
				await expect(backPill(page)).toBeVisible();
				await expectNoViolations(page, `${url} (desktop)`);
			}
		);

		test(
			`${url} ticked, at 1 serving and scrolled has no violations`,
			{ tag: lang === 'en' ? ['@cross-browser'] : [] },
			async ({ page }, testInfo) => {
				onlyInAxeProject(testInfo);
				await openRecipe(page, url);
				await stepServingsTo(page, lang, 2, 1);
				await ingredientRows(page).first().click();
				await stepRows(page).first().click();
				await expect(stepRows(page).first()).toHaveAttribute('aria-pressed', 'true');
				await scrollWindowTo(page, Math.floor(await maxWindowScroll(page)));
				await expectNoViolations(page, `${url} (desktop, ticked, scrolled)`);
			}
		);
	}
});
