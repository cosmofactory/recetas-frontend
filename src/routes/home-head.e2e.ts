import { expect, test, type TestInfo } from '@playwright/test';
import { LOCALES } from '../testutil/e2e';
import { PUBLIC_ORIGIN } from '../testutil/e2e-origin';
import { gotoHydrated, HOME_COPY } from '../testutil/home-e2e';
import {
	ANDALUCIA_EN,
	GALICIA_EN,
	GALICIA_ES,
	GALICIA_RU,
	tapRegion
} from '../testutil/region-e2e';

// FE-4 PR 2 review (stage FE-4 -> Small decisions, "Home <title> and
// description from existing copy"; the design has no meta strings): the
// home is "Asadorov · {aboutTitle}", Popular adds its tab label
// ("Asadorov · {Popular} · {aboutTitle}"-style), and the description is
// the desktop about paragraph, all localized. Server-rendered (crawlers),
// so checked with JavaScript off. Region titles: below (PR 3).
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

// FE-4 PR 3 (stage FE-4 -> Region sheet: "Page <title> and meta description
// per region, localised"). Decision, consistent with the home's
// "Asadorov · {aboutTitle}": a region is "Asadorov · {region name}", and its
// description is the region's description from the catalog. The canonical
// URL stays the region URL (head-links.ts, every page).
const REGION_HEAD: Record<(typeof LOCALES)[number], { name: string; description: string }> = {
	en: { name: GALICIA_EN.name, description: GALICIA_EN.description },
	es: GALICIA_ES,
	ru: { name: GALICIA_RU.name, description: GALICIA_RU.description }
};

test.describe('region <title> and meta description (server-rendered)', () => {
	test.use({ javaScriptEnabled: false });

	for (const locale of LOCALES) {
		const region = REGION_HEAD[locale];
		const url = `/${locale}/regions/gal`;

		test(`${url} is titled "Asadorov · ${region.name}"`, async ({ page }, testInfo) => {
			onlyInHeadProject(testInfo);
			await page.goto(url);
			await expect(page.locator('head title')).toHaveCount(1);
			expect(await page.title()).toBe(`Asadorov${SEPARATOR}${region.name}`);
		});

		test(`${url} has the region description as its description`, async ({ page }, testInfo) => {
			onlyInHeadProject(testInfo);
			await page.goto(url);
			const meta = page.locator('head meta[name="description"]');
			await expect(meta).toHaveCount(1);
			await expect(meta).toHaveAttribute('content', region.description);
		});

		test(`${url} keeps its own canonical URL`, async ({ page }, testInfo) => {
			onlyInHeadProject(testInfo);
			await page.goto(url);
			const canonical = page.locator('head link[rel="canonical"]');
			await expect(canonical).toHaveCount(1);
			await expect(canonical).toHaveAttribute('href', `${PUBLIC_ORIGIN}${url}`);
		});
	}

	test('/en/regions/and is titled by its own region', async ({ page }, testInfo) => {
		onlyInHeadProject(testInfo);
		await page.goto('/en/regions/and');
		expect(await page.title()).toBe(`Asadorov${SEPARATOR}${ANDALUCIA_EN.name}`);
	});
});

// The (home) layout stays mounted between home and region pages, so the
// head must follow client-side navigation too.
test.describe('region <title> on client-side navigation', () => {
	test('/en/ → a region → Back updates the title both ways', async ({ page }, testInfo) => {
		onlyInHeadProject(testInfo);
		await gotoHydrated(page, '/en/');
		await tapRegion(page, 'gal');
		await expect(page).toHaveTitle(`Asadorov${SEPARATOR}${GALICIA_EN.name}`);
		await expect(page.locator('head meta[name="description"]')).toHaveAttribute(
			'content',
			GALICIA_EN.description
		);
		await page.goBack();
		await page.waitForURL((url) => url.pathname === '/en/');
		await expect(page).toHaveTitle(`Asadorov${SEPARATOR}${HOME_COPY.en.aboutTitle}`);
		await expect(page.locator('head meta[name="description"]')).toHaveCount(1);
	});
});
