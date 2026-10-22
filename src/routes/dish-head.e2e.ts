import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { gotoHydrated, HOME_COPY } from '../testutil/home-e2e';
import { pageTitle, TORTILLA_PAGE, VARIATIONS_LOCALES } from '../testutil/variations-copy';
import { variationCards } from '../testutil/variations-e2e';

// FE-6 PR 2 (stage FE-6 -> Small decisions; Preparation): the Variations
// page is "Asadorov · {dish name}" with the dish description; the Recipe
// placeholder is already "Asadorov · {dish name} · {variation name}". Every
// page has a <title> because SvelteKit's route announcer reads it on each
// client navigation (it says "untitled page" when there is none), so the
// announcer must read each page's own title. The head is server-rendered
// (crawlers), so it is checked with JavaScript off, and it doesn't depend
// on the viewport, so it runs in one project.

const PROJECT = 'chromium-mobile-390';
const ANNOUNCER = '#svelte-announcer';

function onlyInHeadProject(testInfo: TestInfo) {
	test.skip(testInfo.project.name !== PROJECT, `head checks run in ${PROJECT} only`);
}

async function expectAnnounced(page: Page, title: string) {
	await expect(page).toHaveTitle(title);
	await expect(page.locator(ANNOUNCER)).toHaveText(title);
}

test.describe('Variations and Recipe <title> (server-rendered)', () => {
	test.use({ javaScriptEnabled: false });

	for (const lang of VARIATIONS_LOCALES) {
		const copy = TORTILLA_PAGE[lang];
		const variations = `/${lang}/dishes/tortilla`;
		const recipe = `/${lang}/dishes/tortilla/gal`;

		test(`${variations} is titled "${pageTitle(copy.name)}"`, async ({ page }, testInfo) => {
			onlyInHeadProject(testInfo);
			await page.goto(variations);
			await expect(page.locator('head title')).toHaveCount(1);
			expect(await page.title()).toBe(pageTitle(copy.name));
		});

		test(`${variations} has the dish description as its description`, async ({
			page
		}, testInfo) => {
			onlyInHeadProject(testInfo);
			await page.goto(variations);
			const meta = page.locator('head meta[name="description"]');
			await expect(meta).toHaveCount(1);
			await expect(meta).toHaveAttribute('content', copy.description);
		});

		const recipeTitle = pageTitle(copy.name, copy.cards[0].name);
		test(`${recipe} is titled "${recipeTitle}"`, async ({ page }, testInfo) => {
			onlyInHeadProject(testInfo);
			await page.goto(recipe);
			await expect(page.locator('head title')).toHaveCount(1);
			expect(await page.title()).toBe(recipeTitle);
		});
	}
});

test.describe('route announcer on client navigation', () => {
	test('home → Variations → Recipe → Back: each page is announced by its title', async ({
		page
	}, testInfo) => {
		onlyInHeadProject(testInfo);
		const copy = TORTILLA_PAGE.en;
		await gotoHydrated(page, '/en/');
		await page.evaluate(() => {
			const a = document.createElement('a');
			a.href = '/en/dishes/tortilla';
			document.querySelector('[data-testid="app-shell"]')!.append(a);
			a.click();
		});
		await page.waitForURL((url) => url.pathname === '/en/dishes/tortilla');
		await expectAnnounced(page, pageTitle(copy.name));
		await variationCards(page).first().click();
		await page.waitForURL((url) => url.pathname === '/en/dishes/tortilla/gal');
		await expectAnnounced(page, pageTitle(copy.name, copy.cards[0].name));
		await page.goBack();
		await page.waitForURL((url) => url.pathname === '/en/dishes/tortilla');
		await expectAnnounced(page, pageTitle(copy.name));
		await page.goBack();
		await page.waitForURL((url) => url.pathname === '/en/');
		await expectAnnounced(page, pageTitle(HOME_COPY.en.aboutTitle));
	});
});
