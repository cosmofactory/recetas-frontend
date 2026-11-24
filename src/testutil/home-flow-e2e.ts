import { expect, type Page } from '@playwright/test';
import { gotoHydrated, pathAndQuery } from './home-e2e';
import { DISH_NAMES, type DISH_KEYS, HANDLE_LABELS } from './popular-copy';
import {
	dishCard,
	dishCards,
	dishSheet,
	listScroller,
	scrollListToEnd,
	seeAllLink
} from './popular-e2e';
import { expectSheetExpanded, expectSheetPeek } from './region-e2e';
import type { VariationsLocale } from './variations-copy';
import { waitForPagePushEnd } from './variations-e2e';

// The FE-6 home → Variations flow shared by the Variations and Recipe specs
// (D-FE6-1: Back returns home with its exact URL, sheet and list scroll).

export type DishKey = (typeof DISH_KEYS)[number];

// A dish as the list shows it: its key and its card's (and sheet's) name.
export type ShownDish = { key: string; name: string };

export const HOME_WITH_FILTERS = '/en/?tab=popular&f=tapas&f=mains&f=desserts';
const SCROLL_TOLERANCE_PX = 1;

export type HomeState = { url: string; scrollTop: number; dish: ShownDish };

export async function expectUrl(page: Page, want: string) {
	await page.waitForURL((url) => url.pathname + url.search === want);
	expect(pathAndQuery(page)).toBe(want);
}

// Popular → the dish sheet (expanded) → "See all variations".
export async function seeAllFromSheet(page: Page, lang: VariationsLocale, dishKey: DishKey) {
	await openSheetAndSeeAll(page, lang, { key: dishKey, name: DISH_NAMES[lang][dishKey] });
}

async function openSheetAndSeeAll(page: Page, lang: VariationsLocale, dish: ShownDish) {
	await dishCard(page, dish.key).click();
	await page.waitForURL((url) => url.searchParams.get('dish') === dish.key);
	await expectSheetPeek(page, dish.name);
	await dishSheet(page).getByRole('button', { name: HANDLE_LABELS[lang], exact: true }).click();
	await expectSheetExpanded(page, dish.name);
	await seeAllLink(page, lang).click();
	await expectUrl(page, `/${lang}/dishes/${dish.key}`);
	await waitForPagePushEnd(page);
}

// The last card in the list that opens a dish sheet (FE-11: a one-variation
// dish's card opens its recipe instead), read from the page, so the flow
// runs on whatever content the server under test serves.
async function lowestSheetDish(page: Page): Promise<ShownDish> {
	const cards = await dishCards(page).evaluateAll((links) =>
		links.map((link) => ({
			href: link.getAttribute('href') ?? '',
			name: link.querySelector('h3')?.textContent?.trim() ?? ''
		}))
	);
	const withSheet = cards.map((card) => ({ key: sheetDishKey(card.href), name: card.name }));
	const lowest = withSheet.filter((dish) => dish.key !== null).at(-1);
	if (!lowest?.key) throw new Error(`got no card that opens a dish sheet among ${cards.length}`);
	return { key: lowest.key, name: lowest.name };
}

// The ?dish= key of a card's sheet URL; null for a card that opens a page.
const sheetDishKey = (href: string) => new URL(href, 'http://x').searchParams.get('dish');

// The home with filters, its list scrolled to the end and the lowest dish's
// sheet open, then its Variations page. Returns the home URL, offset and dish.
export async function leaveScrolledHome(page: Page): Promise<HomeState> {
	await gotoHydrated(page, HOME_WITH_FILTERS);
	await scrollListToEnd(page);
	const dish = await lowestSheetDish(page);
	// The click below would scroll a partly hidden card into view first, so
	// reveal it now and record the offset the home is really left at.
	await dishCard(page, dish.key).scrollIntoViewIfNeeded();
	const { scrollTop } = await listScroller(page);
	expect(scrollTop, 'want the Popular list scrolled before leaving').toBeGreaterThan(0);
	await openSheetAndSeeAll(page, 'en', dish);
	return { url: `${HOME_WITH_FILTERS}&dish=${dish.key}`, scrollTop, dish };
}

export async function expectHomeRestored(page: Page, home: HomeState) {
	await expectUrl(page, home.url);
	await expectSheetPeek(page, home.dish.name);
	await expect
		.poll(async () => Math.abs((await listScroller(page)).scrollTop - home.scrollTop), {
			message: `want the Popular list back at scrollTop ${home.scrollTop}`
		})
		.toBeLessThanOrEqual(SCROLL_TOLERANCE_PX);
}

// A recipe path of `dishKey`: a regional variation's or a Spanish one's.
export const recipePathOf = (dishKey: string) =>
	new RegExp(`^/en/dishes/${dishKey}/(esp/[a-z0-9-]+|[a-z]+)$`);
