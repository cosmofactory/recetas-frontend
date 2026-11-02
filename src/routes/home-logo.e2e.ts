import { expect, test, type Locator, type Page } from '../testutil/e2e-test';
import { LOGO } from '../testutil/about-copy';
import {
	gotoHydrated,
	HOME_COPY,
	isDesktopPage,
	onlyVisible,
	pathAndQuery,
	tab
} from '../testutil/home-e2e';
import { expectSheetHidden, regionSheet } from '../testutil/region-e2e';

// FE-9 FB-11 (D-FE9-7), mobile README -> Screen 1 -> Header: the logo
// "Asadorov" "links to the start page, `/:lang/` (Regional, nothing open),
// like the desktop logo". Stage file: "With a region open the scrim covers
// the header, so a tap there closes the region first (same destination)."
// So from a region URL the test taps once where the logo is and checks only
// the end state (`/es/`, Regional, no sheet), whichever element took the tap
// (the scrim's close and the logo both go to `/:lang/`).
// Desktop's logo link is covered by home-header and dish-pages-top-bar.

const LANG = 'es';
const HOME = `/${LANG}/`;
const REGION_KEY = 'val';

function skipUnlessMobile(page: Page) {
	test.skip(isDesktopPage(page), 'mobile header logo: below 860px only');
}

const logoLink = (page: Page): Locator =>
	onlyVisible(page.getByRole('link', { name: LOGO, exact: true }));

async function expectLogoLinksHome(page: Page) {
	await expect(logoLink(page), `want one visible "${LOGO}" link`).toHaveCount(1);
	await expect(logoLink(page)).toHaveAttribute('href', HOME);
}

// A real pointer press at the logo's centre: lands on the scrim when one
// covers the header, on the logo otherwise.
async function tapAtLogo(page: Page) {
	const box = await logoLink(page).boundingBox();
	expect(box, 'got no box for the logo link').not.toBeNull();
	await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
}

async function expectRegionalHome(page: Page) {
	await expect.poll(() => pathAndQuery(page), { message: `want ${HOME}` }).toBe(HOME);
	await expect(tab(page, HOME_COPY[LANG].regional)).toHaveAttribute('aria-selected', 'true');
	await expect(tab(page, HOME_COPY[LANG].popular)).toHaveAttribute('aria-selected', 'false');
	await expectSheetHidden(page);
}

test.describe('mobile logo links to the start page', () => {
	test(
		`from /${LANG}/?tab=popular a tap on the logo lands on ${HOME}, Regional`,
		{ tag: '@cross-browser' },
		async ({ page }) => {
			skipUnlessMobile(page);
			await gotoHydrated(page, `${HOME}?tab=popular`);
			await expectLogoLinksHome(page);
			await logoLink(page).click();
			await expectRegionalHome(page);
		}
	);

	test(
		`from /${LANG}/regions/${REGION_KEY} tapping the logo ends on ${HOME} with no sheet`,
		{ tag: '@cross-browser' },
		async ({ page }) => {
			skipUnlessMobile(page);
			await gotoHydrated(page, `${HOME}regions/${REGION_KEY}`);
			await expect(regionSheet(page)).toHaveAttribute('data-state', 'peek');
			await expectLogoLinksHome(page);
			await tapAtLogo(page);
			await expectRegionalHome(page);
		}
	);
});
