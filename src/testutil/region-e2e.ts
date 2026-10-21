import { expect, type Locator, type Page } from '@playwright/test';
import { tokenValue, visibleMap } from './home-e2e';

// Shared fixtures for the FE-4 PR 3 region sheet / panel Playwright specs
// (home-region*.e2e.ts, home-head.e2e.ts). Content is the vendored mock
// bundle (DATA_SOURCE=mock), in dish order; the counts are the ICU plural
// home.variation (strings.json).

export type RegionRow = { dishKey: string; name: string; description: string };

export type RegionCopy = {
	key: string;
	name: string;
	description: string;
	count: string;
	chips: string[];
	rows: RegionRow[];
};

export const GALICIA_EN: RegionCopy = {
	key: 'gal',
	name: 'Galicia',
	description: 'Atlantic seafood, pilgrim fare and Spain’s best-loved octopus.',
	count: '4 variations',
	chips: ['Pulpo á feira', 'Empanada gallega', 'Lacón con grelos'],
	rows: [
		{
			dishKey: 'tortilla',
			name: 'Betanzos-style runny',
			description: 'Barely-set centre, no onion, eaten with bread'
		},
		{
			dishKey: 'cocido',
			name: 'Cocido gallego',
			description: 'Grelos, pork shoulder and cachelos'
		},
		{ dishKey: 'croquetas', name: 'De marisco', description: 'Built on leftover shellfish stock' },
		{ dishKey: 'torrijas', name: 'Filloas', description: 'Thin crêpes, sometimes made with broth' }
	]
};

export const GALICIA_RU: RegionCopy = {
	key: 'gal',
	name: 'Галисия',
	description: 'Атлантические морепродукты, еда паломников и самый любимый осьминог Испании.',
	count: '4 варианта',
	chips: GALICIA_EN.chips,
	rows: [
		{
			dishKey: 'tortilla',
			name: 'По-бетансосски, жидкая внутри',
			description: 'Едва схваченная серединка, без лука, едят с хлебом'
		},
		{
			dishKey: 'cocido',
			name: 'Cocido gallego',
			description: 'Грелос, свиная лопатка и отварной картофель'
		},
		{ dishKey: 'croquetas', name: 'De marisco', description: 'На бульоне от морепродуктов' },
		{ dishKey: 'torrijas', name: 'Filloas', description: 'Тонкие блинчики, иногда на бульоне' }
	]
};

export const GALICIA_ES = {
	name: 'Galicia',
	description: 'Marisco atlántico, cocina de peregrinos y el pulpo más querido de España.'
};

export const ANDALUCIA_EN: RegionCopy = {
	key: 'and',
	name: 'Andalucía',
	description: 'Cold soups, fried fish and eight provinces of contrasts.',
	count: '6 variations',
	chips: ['Gazpacho andaluz', 'Salmorejo cordobés', 'Pescaíto frito'],
	rows: [
		{
			dishKey: 'tortilla',
			name: 'Thin, olive-oil heavy',
			description: 'Wide and thin, generous picual oil'
		},
		{
			dishKey: 'paella',
			name: 'Arroz caldoso de marisco',
			description: 'Soupy — spooned, not forked'
		},
		{
			dishKey: 'cocido',
			name: 'Puchero andaluz',
			description: 'Chickpeas and mint, pringá spread on bread'
		},
		{
			dishKey: 'gazpacho',
			name: 'Gazpacho andaluz',
			description: 'Thickened with bread, drunk from a glass'
		},
		{ dishKey: 'croquetas', name: 'De puchero', description: 'Made from yesterday’s pringá' },
		{
			dishKey: 'torrijas',
			name: 'Torrijas de vino',
			description: 'Sweet wine instead of milk, honey poured over'
		}
	]
};

export const ANDALUCIA_RU_NAME = 'Андалусия';

// extra-strings.json a11y.sheetHandle: the handle's name (it has no text).
export const HANDLE_LABEL_EN = 'Expand or collapse';

export function recipeUrl(lang: string, row: RegionRow, regionKey: string): string {
	return `/${lang}/dishes/${row.dishKey}/${regionKey}`;
}

// The mobile region sheet: BottomSheet (role="dialog", data-state).
export function regionSheet(page: Page): Locator {
	return page.locator('[role="dialog"][data-state]');
}

// The desktop region panel: StickyPanel, a <section> named by the region.
export function regionPanel(page: Page, name: string): Locator {
	return page.getByRole('region', { name, exact: true });
}

export function regionLink(page: Page, key: string, lang = 'en'): Locator {
	return visibleMap(page).locator(`a[href="/${lang}/regions/${key}"]`);
}

export function rowLinks(container: Locator, lang: string, region: RegionCopy): Locator[] {
	return region.rows.map((row) =>
		container.locator(`a[href="${recipeUrl(lang, row, region.key)}"]`)
	);
}

// Clicks a cell of the region's map link (only cells take pointer events).
export async function tapRegion(page: Page, key: string, lang = 'en') {
	await regionLink(page, key, lang).locator('[data-map-cell]').first().click();
	await page.waitForURL((url) => url.pathname === `/${lang}/regions/${key}`);
}

// Keyboard activation of a map region (works with the scrim over the map).
export async function activateRegion(page: Page, key: string, lang = 'en') {
	await regionLink(page, key, lang).focus();
	await page.keyboard.press('Enter');
	await page.waitForURL((url) => url.pathname === `/${lang}/regions/${key}`);
}

export async function viewportHeight(page: Page): Promise<number> {
	return page.evaluate(() => window.innerHeight);
}

// From the layout box, not boundingBox(): that is null once the hidden
// sheet is visibility: hidden.
async function sheetTop(page: Page): Promise<number> {
	return regionSheet(page).evaluate((el) => el.getBoundingClientRect().top);
}

const TOP_TOLERANCE_PX = 1;

// Waits until the sheet's top edge rests `fromBottom` px above the frame's
// bottom (the design's peek / expanded positions), after its transition.
async function expectSheetTopAt(page: Page, fromBottom: number, what: string) {
	const want = (await viewportHeight(page)) - fromBottom;
	await expect
		.poll(async () => Math.abs((await sheetTop(page)) - want), {
			message: `want the sheet top at ${want}px (${what})`
		})
		.toBeLessThanOrEqual(TOP_TOLERANCE_PX);
}

export async function expectSheetPeek(page: Page, regionName: string) {
	const sheet = regionSheet(page);
	await expect(sheet).toHaveAttribute('data-state', 'peek');
	await expect(sheet).toHaveAttribute('aria-label', regionName);
	await expect(sheet).not.toHaveAttribute('inert');
	await expect(sheet).not.toHaveAttribute('aria-modal', 'true');
	const peek = parseFloat(await tokenValue(page, 'height', 'var(--sheet-peek)'));
	await expectSheetTopAt(page, peek, 'peek');
	const heading = sheet.getByRole('heading', { level: 2, name: regionName, exact: true });
	await expect(heading).toBeInViewport();
}

export async function expectSheetExpanded(page: Page, regionName: string) {
	const sheet = regionSheet(page);
	await expect(sheet).toHaveAttribute('data-state', 'expanded');
	await expect(sheet).toHaveAttribute('aria-label', regionName);
	await expect(sheet).toHaveAttribute('aria-modal', 'true');
	const height = parseFloat(await tokenValue(page, 'height', 'var(--sheet-height)'));
	await expectSheetTopAt(page, height, 'expanded');
}

export async function expectSheetHidden(page: Page) {
	const sheet = regionSheet(page);
	await expect(sheet).toHaveAttribute('data-state', 'hidden');
	await expect(sheet).toHaveAttribute('inert');
	// At rest a hidden sheet paints nothing over the frame (visibility:
	// hidden, so axe can decide the contrast of the page under it).
	await expect(sheet, 'want the hidden sheet visibility: hidden at rest').toBeHidden();
	const bottom = await viewportHeight(page);
	await expect
		.poll(() => sheetTop(page), { message: 'want the hidden sheet below the frame' })
		.toBeGreaterThanOrEqual(bottom);
}

// Taps the scrim where it covers the top of the map (above the peek sheet).
export async function tapScrim(page: Page) {
	const map = await visibleMap(page).boundingBox();
	expect(map, 'got no map to tap the scrim over').not.toBeNull();
	await page.mouse.click(map!.x + map!.width / 2, map!.y + 8);
}

// Records every data-state the sheet passes through from now on, and tags
// the element, so a later check can tell it never closed and never remounted.
export async function recordSheet(page: Page) {
	await regionSheet(page).evaluate((el) => {
		const seen: string[] = [];
		const w = window as unknown as { __sheetStates: string[]; __sheet: Element };
		w.__sheetStates = seen;
		w.__sheet = el;
		const record = () => seen.push(el.getAttribute('data-state') ?? '');
		new MutationObserver(record).observe(el, { attributes: true, attributeFilter: ['data-state'] });
	});
}

export async function recordedSheet(page: Page): Promise<{ states: string[]; same: boolean }> {
	return regionSheet(page).evaluate((el) => {
		const w = window as unknown as { __sheetStates?: string[]; __sheet?: Element };
		return { states: w.__sheetStates ?? [], same: w.__sheet === el };
	});
}

export async function historyLength(page: Page): Promise<number> {
	return page.evaluate(() => history.length);
}

// The map links currently marked selected (aria-current="true").
export function selectedRegions(page: Page): Locator {
	return visibleMap(page).locator('a[aria-current="true"]');
}
