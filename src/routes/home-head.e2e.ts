import { expect, test, type TestInfo } from '@playwright/test';
import { LOCALES } from '../testutil/e2e';
import { HOME_COPY } from '../testutil/home-e2e';

// FE-4 PR 2 review (stage FE-4 -> Small decisions, "Home <title> and
// description from existing copy"; the design has no meta strings): the
// home is "Asadorov · {aboutTitle}", Popular adds its tab label
// ("Asadorov · {Popular} · {aboutTitle}"-style), and the description is
// the desktop about paragraph, all localized. Server-rendered (crawlers),
// so checked with JavaScript off. Region titles arrive with PR 3.
// The head doesn't depend on the viewport, so it runs in one project.

const PROJECT = 'chromium-desktop-1280';
const SEPARATOR = ' · ';

function onlyInHeadProject(testInfo: TestInfo) {
	test.skip(testInfo.project.name !== PROJECT, `head checks run in ${PROJECT} only`);
}

test.describe('home <title> and meta description (server-rendered)', () => {
	test.use({ javaScriptEnabled: false });

	for (const locale of LOCALES) {
		const copy = HOME_COPY[locale];

		test(`/${locale}/ is titled "Asadorov · ${copy.aboutTitle}"`, async ({ page }, testInfo) => {
			onlyInHeadProject(testInfo);
			await page.goto(`/${locale}/`);
			await expect(page.locator('head title')).toHaveCount(1);
			expect(await page.title()).toBe(`Asadorov${SEPARATOR}${copy.aboutTitle}`);
		});

		test(`/${locale}/ has the about paragraph as its description`, async ({ page }, testInfo) => {
			onlyInHeadProject(testInfo);
			await page.goto(`/${locale}/`);
			const meta = page.locator('head meta[name="description"]');
			await expect(meta).toHaveCount(1);
			await expect(meta).toHaveAttribute('content', copy.aboutBody);
		});

		test(`/${locale}/?tab=popular names the Popular tab in its title`, async ({
			page
		}, testInfo) => {
			onlyInHeadProject(testInfo);
			await page.goto(`/${locale}/?tab=popular`);
			const title = await page.title();
			expect(title, `got "${title}"`).toMatch(/^Asadorov · /);
			expect(title, `got "${title}", want "${copy.popular}" in it`).toContain(copy.popular);
			expect(title, `got "${title}", want it to differ from Regional`).not.toBe(
				`Asadorov${SEPARATOR}${copy.aboutTitle}`
			);
		});

		test(`/${locale}/?tab=popular keeps the description`, async ({ page }, testInfo) => {
			onlyInHeadProject(testInfo);
			await page.goto(`/${locale}/?tab=popular`);
			const meta = page.locator('head meta[name="description"]');
			await expect(meta).toHaveCount(1);
			await expect(meta).toHaveAttribute('content', copy.aboutBody);
		});
	}
});
