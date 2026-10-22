import { expect, type Page } from '@playwright/test';
import { gotoHydrated, pathAndQuery } from './home-e2e';
import { DISH_NAMES, type DISH_KEYS, HANDLE_LABELS } from './popular-copy';
import { dishCard, dishSheet, listScroller, scrollListToEnd, seeAllLink } from './popular-e2e';
import { expectSheetExpanded, expectSheetPeek } from './region-e2e';
import type { VariationsLocale } from './variations-copy';
import { waitForPagePushEnd } from './variations-e2e';

// The FE-6 home → Variations flow shared by the Variations and Recipe specs
// (D-FE6-1: Back returns home with its exact URL, sheet and list scroll).

export type DishKey = (typeof DISH_KEYS)[number];

export const HOME_WITH_FILTERS = '/en/?tab=popular&f=tapas&f=mains&f=desserts';
// The last dish the filters keep, so the list must scroll to reach it.
export const LOWEST_DISH = 'arrozleche' satisfies DishKey;
const SCROLL_TOLERANCE_PX = 1;

export type HomeState = { url: string; scrollTop: number };

export async function expectUrl(page: Page, want: string) {
	await page.waitForURL((url) => url.pathname + url.search === want);
	expect(pathAndQuery(page)).toBe(want);
}

// Popular → the dish sheet (expanded) → "See all variations".
export async function seeAllFromSheet(page: Page, lang: VariationsLocale, dishKey: DishKey) {
	await dishCard(page, dishKey).click();
	await page.waitForURL((url) => url.searchParams.get('dish') === dishKey);
	const name = DISH_NAMES[lang][dishKey];
	await expectSheetPeek(page, name);
	await dishSheet(page).getByRole('button', { name: HANDLE_LABELS[lang], exact: true }).click();
	await expectSheetExpanded(page, name);
	await seeAllLink(page, lang).click();
	await expectUrl(page, `/${lang}/dishes/${dishKey}`);
	await waitForPagePushEnd(page);
}

// The home with filters, its list scrolled to the end and the lowest dish's
// sheet open, then its Variations page. Returns the home URL and offset.
export async function leaveScrolledHome(page: Page): Promise<HomeState> {
	await gotoHydrated(page, HOME_WITH_FILTERS);
	const { scrollTop } = await scrollListToEnd(page);
	expect(scrollTop, 'want the Popular list scrolled before leaving').toBeGreaterThan(0);
	await seeAllFromSheet(page, 'en', LOWEST_DISH);
	return { url: `${HOME_WITH_FILTERS}&dish=${LOWEST_DISH}`, scrollTop };
}

export async function expectHomeRestored(page: Page, home: HomeState) {
	await expectUrl(page, home.url);
	await expectSheetPeek(page, DISH_NAMES.en[LOWEST_DISH]);
	await expect
		.poll(async () => Math.abs((await listScroller(page)).scrollTop - home.scrollTop), {
			message: `want the Popular list back at scrollTop ${home.scrollTop}`
		})
		.toBeLessThanOrEqual(SCROLL_TOLERANCE_PX);
}
