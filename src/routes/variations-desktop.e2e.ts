import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { expectNoViolations } from '../testutil/axe-e2e';
import {
	backPill,
	columnOf,
	contentBox,
	expectPillWithHref,
	gridAround,
	photoHeight,
	pillHomeLabel,
	visiblePhoto
} from '../testutil/desktop-pages-e2e';
import { boxOf, computedStyle, expectPx, gotoHydrated, tokenValue } from '../testutil/home-e2e';
import { skipOnDesktop, skipOnMobile } from '../testutil/popular-e2e';
import { TORTILLA_PAGE, VARIATIONS_LOCALES, PAGE_COPY } from '../testutil/variations-copy';
import { backLink, scrollWindowTo, variationCards } from '../testutil/variations-e2e';

// FE-6 PR 4, the desktop (≥ 860px) Variations page: layout metrics and the
// server-rendered back pill.
// Tiered matrix (stack.md F4): the core projects run every test; geometry
// is @layout (also 860×800 and 1440×900), engine behaviour @cross-browser
// (WebKit 1440, Firefox 1280), axe once per desktop engine.
// The acceptance "layouts match the prototype at 1280×800 and 1440×900" is
// covered by the @layout metrics at both sizes, not by pixel snapshots.
//
// Sources:
// - Desktop README -> Layout & screens -> Variations page: "back pill
//   ("‹ Popular" / "‹ Regional"), header grid 1fr/1fr: count, title (serif
//   64px, lh .98), description 17px | 320px hero photo. Cards grid
//   repeat(auto-fill, minmax(300px, 1fr)), gap 22px: 190px photo, region
//   eyebrow, 25px serif name, description, "View recipe →"."
// - Desktop prototype L181–205, which wins over the README: the page is a
//   1440px-capped column with the fluid side padding, the pill first; the
//   header's tracks are minmax(0,1fr) minmax(0,1fr); the count (13px/700,
//   accent) sits above the title, the description (17px, lh 1.55) below.
// - Stage FE-6 -> Small decisions: the SSR pill is the direct-load one,
//   "‹ Popular" to /:lang/?tab=popular; it replaces the StickyTopBar.

const HEADER_HERO_PX = 320;
const TITLE_PX = 64;
const TITLE_LINE_HEIGHT = 0.98;
const DESCRIPTION_PX = 17;
const CARD_MIN_WIDTH_PX = 300;
const CARD_GAP_PX = 22;
const CARD_PHOTO_PX = 190;
const CARD_NAME_PX = 25;
const FAR_DOWN_PX = 600;
const URL_EN = '/en/dishes/tortilla';

const title = (page: Page) => page.getByRole('heading', { level: 1 });

async function openVariations(page: Page, url = URL_EN) {
	await gotoHydrated(page, url);
	await expect(title(page)).toBeVisible();
}

// repeat(auto-fill, minmax(300px, 1fr)) with a 22px gap in `width`.
function cardTracks(width: number): { count: number; track: number } {
	const count = Math.floor((width + CARD_GAP_PX) / (CARD_MIN_WIDTH_PX + CARD_GAP_PX));
	return { count, track: (width - CARD_GAP_PX * (count - 1)) / count };
}

test.describe('Variations (desktop): header grid', () => {
	test.beforeEach(({ page }) => skipOnMobile(page, 'the desktop Variations layout (≥ 860px)'));

	test(
		'1fr | 1fr in the 1440px page container: the title column, then the 320px hero',
		{ tag: '@layout' },
		async ({ page }) => {
			await openVariations(page);
			const grid = await gridAround(title(page), 'the title');
			const want = await contentBox(page);
			expectPx(grid.box.x, want.x, 'header grid x');
			expectPx(grid.box.width, want.width, 'header grid width');
			expect(grid.tracks.length, `got tracks ${grid.tracks}, want 2`).toBe(2);
			expectPx(grid.tracks[0], grid.tracks[1], 'header tracks (1fr = 1fr)');
			const titleBox = await boxOf(title(page), 'the title');
			const heroBox = await boxOf(visiblePhoto(page.locator('main')), 'the hero');
			expect(columnOf(grid, titleBox), 'want the title in the first column').toBe(0);
			expect(columnOf(grid, heroBox), 'want the hero in the second column').toBe(1);
			expectPx(heroBox.height, HEADER_HERO_PX, 'hero height');
			expectPx(heroBox.width, grid.tracks[1], 'hero width (fills its column)');
		}
	);

	test(
		'count above a 64px serif title (lh .98), 17px description below it',
		{ tag: '@layout' },
		async ({ page }) => {
			await openVariations(page);
			const copy = TORTILLA_PAGE.en;
			const style = await computedStyle(title(page), ['font-size', 'line-height', 'font-family']);
			expect(style['font-size']).toBe(`${TITLE_PX}px`);
			expectPx(parseFloat(style['line-height']), TITLE_PX * TITLE_LINE_HEIGHT, 'title line-height');
			expect(style['font-family']).toBe(
				await tokenValue(page, 'font-family', 'var(--font-display)')
			);
			const count = page.getByText(copy.count, { exact: true });
			const description = page.getByText(copy.description, { exact: true });
			const titleBox = await boxOf(title(page), 'the title');
			const countBox = await boxOf(count, 'the count');
			const descriptionBox = await boxOf(description, 'the description');
			expect(countBox.y + countBox.height, 'want the count above the title').toBeLessThanOrEqual(
				titleBox.y
			);
			expect(descriptionBox.y, 'want the description below the title').toBeGreaterThanOrEqual(
				titleBox.y + titleBox.height
			);
			expect((await computedStyle(description, ['font-size']))['font-size']).toBe(
				`${DESCRIPTION_PX}px`
			);
		}
	);

	test(
		'the back pill comes first, above the header; no sticky top bar',
		{ tag: '@layout' },
		async ({ page }) => {
			await openVariations(page);
			await expect(backPill(page), 'want the desktop back pill').toBeVisible();
			const pill = await boxOf(backPill(page), 'the back pill');
			const grid = await gridAround(title(page), 'the title');
			expect(pill.y + pill.height, 'want the pill above the header').toBeLessThanOrEqual(
				grid.box.y
			);
			expectPx(pill.x, (await contentBox(page)).x, 'pill x (the content edge)');
			await expect(backLink(page, 'en'), 'want no StickyTopBar back button').toBeHidden();
		}
	);
});

test.describe('Variations (desktop): cards grid', () => {
	test.beforeEach(({ page }) => skipOnMobile(page, 'the desktop Variations layout (≥ 860px)'));

	test(
		'auto-fill minmax(300px, 1fr), gap 22px, across the content box',
		{ tag: '@layout' },
		async ({ page }) => {
			await openVariations(page);
			const grid = await gridAround(variationCards(page).first(), 'the variation cards');
			const want = await contentBox(page);
			expectPx(grid.box.x, want.x, 'cards grid x');
			expectPx(grid.box.width, want.width, 'cards grid width');
			expect(grid.columnGap, 'column gap').toBe(CARD_GAP_PX);
			expect(grid.rowGap, 'row gap').toBe(CARD_GAP_PX);
			const { count, track } = cardTracks(want.width);
			expect(grid.tracks.length, `got tracks ${grid.tracks}`).toBe(count);
			const boxes = await variationCards(page).evaluateAll((cards) =>
				cards.map((c) => {
					const r = c.getBoundingClientRect();
					return { x: r.x, y: r.y, width: r.width, height: r.height };
				})
			);
			for (const [i, box] of boxes.entries()) {
				expectPx(box.width, track, `card ${i} width`);
				expectPx(box.x, want.x + (i % count) * (track + CARD_GAP_PX), `card ${i} x`);
			}
			expectPx(boxes[count].y - (boxes[0].y + boxes[0].height), CARD_GAP_PX, 'row gap');
		}
	);

	test(
		'a card: 190px photo, then the region eyebrow and a 25px serif name',
		{ tag: '@layout' },
		async ({ page }) => {
			await openVariations(page);
			const card = variationCards(page).first();
			const first = TORTILLA_PAGE.en.cards[0];
			expectPx(await photoHeight(card, 'the card photo'), CARD_PHOTO_PX, 'card photo height');
			const name = card.getByText(first.name, { exact: true });
			const style = await computedStyle(name, ['font-size', 'font-family']);
			expect(style['font-size']).toBe(`${CARD_NAME_PX}px`);
			expect(style['font-family']).toBe(
				await tokenValue(page, 'font-family', 'var(--font-display)')
			);
			const eyebrow = card.getByText(first.region, { exact: true });
			expect((await computedStyle(eyebrow, ['text-transform']))['text-transform']).toBe(
				'uppercase'
			);
			const photo = await boxOf(visiblePhoto(card), 'the card photo');
			const eyebrowBox = await boxOf(eyebrow, 'the eyebrow');
			const nameBox = await boxOf(name, 'the name');
			expect(eyebrowBox.y, 'want the eyebrow under the photo').toBeGreaterThanOrEqual(
				photo.y + photo.height
			);
			expect(nameBox.y, 'want the name under the eyebrow').toBeGreaterThanOrEqual(
				eyebrowBox.y + eyebrowBox.height
			);
		}
	);

	for (const lang of VARIATIONS_LOCALES) {
		test(`${lang}: each card reads region, name, description, "${PAGE_COPY[lang].viewRecipe}"`, async ({
			page
		}) => {
			await openVariations(page, `/${lang}/dishes/tortilla`);
			for (const [i, copy] of TORTILLA_PAGE[lang].cards.entries()) {
				const card = variationCards(page).nth(i);
				for (const part of [copy.region, copy.name, copy.description, PAGE_COPY[lang].viewRecipe]) {
					await expect(card, `card ${i}: got no "${part}"`).toContainText(part, {
						ignoreCase: true
					});
				}
			}
		});
	}
});

test.describe('Variations (desktop) without JavaScript', () => {
	test.use({ javaScriptEnabled: false });
	test.beforeEach(({ page }) => skipOnMobile(page, 'the desktop Variations layout (≥ 860px)'));

	for (const lang of VARIATIONS_LOCALES) {
		const label = pillHomeLabel(lang, 'popular');

		test(`/${lang}/dishes/tortilla: the pill reads "${label}" and goes to /${lang}/?tab=popular`, async ({
			page
		}) => {
			await page.goto(`/${lang}/dishes/tortilla`);
			await expectPillWithHref(page, label, `/${lang}/?tab=popular`);
			await expect(backLink(page, lang), 'want no StickyTopBar back button').toBeHidden();
		});
	}
});

test.describe('Variations (mobile): no back pill', () => {
	test(
		'below 860px the StickyTopBar has the back button and there is no pill',
		{ tag: '@layout' },
		async ({ page }) => {
			skipOnDesktop(page, 'the mobile Variations layout (< 860px)');
			await openVariations(page);
			await expect(backLink(page, 'en')).toBeVisible();
			await expect(backPill(page)).toBeHidden();
		}
	);
});

// Every desktop engine; the other Chromium widths add nothing to axe.
const AXE_PROJECTS = ['chromium-desktop-1280', 'firefox-desktop-1280', 'webkit-desktop-1440'];

function onlyInAxeProject(testInfo: TestInfo) {
	test.skip(
		!AXE_PROJECTS.includes(testInfo.project.name),
		`axe runs in ${AXE_PROJECTS.join(', ')}`
	);
}

test.describe('axe: WCAG 2.2 AA on the desktop Variations page', () => {
	for (const lang of VARIATIONS_LOCALES) {
		const url = `/${lang}/dishes/tortilla`;

		test(
			`${url} has no violations`,
			{ tag: lang === 'en' ? ['@cross-browser'] : [] },
			async ({ page }, testInfo) => {
				onlyInAxeProject(testInfo);
				await openVariations(page, url);
				await expect(backPill(page)).toBeVisible();
				await expectNoViolations(page, `${url} (desktop)`);
			}
		);
	}

	test('/en/dishes/paella scrolled has no violations', async ({ page }, testInfo) => {
		onlyInAxeProject(testInfo);
		await openVariations(page, '/en/dishes/paella');
		await scrollWindowTo(page, FAR_DOWN_PX);
		await expectNoViolations(page, '/en/dishes/paella (desktop, scrolled)');
	});
});
