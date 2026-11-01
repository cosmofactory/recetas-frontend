import bundle from '../lib/server/mock/content.bundle.json' with { type: 'json' };
import { expect, type Page } from './e2e-test';
import { tokenValue, visibleMap } from './home-e2e';

// FE-9 FB-4 (D-FE9-3): how the map draws a selection. The selected region
// keeps its tileColor; while a region is selected every other region's cells
// drop to --region-dimmed-opacity; labels are never dimmed.

// One region as drawn: its cells' distinct colours and opacities (one each
// when the region is drawn uniformly) and its label's opacity. Opacities are
// effective ones (the product up the ancestor chain), so dimming the whole
// link would show up on the label.
export type RegionLook = {
	key: string;
	colours: string[];
	cellOpacities: number[];
	labelOpacity: number;
};

const DIMMED_TOKEN = '--region-dimmed-opacity';
const OPACITY_DECIMALS = 3;

export async function regionLooks(page: Page): Promise<RegionLook[]> {
	return visibleMap(page)
		.locator('a[href*="/regions/"]')
		.evaluateAll((links, decimals) => {
			const round = (n: number) => Number(n.toFixed(decimals));
			const effectiveOpacity = (el: Element | null): number =>
				el ? Number(getComputedStyle(el).opacity) * effectiveOpacity(el.parentElement) : 1;
			const unique = <T>(values: T[]) => [...new Set(values)];
			return links.map((link) => {
				const cells = [...link.querySelectorAll('[data-map-cell]')];
				return {
					key: link.getAttribute('href')!.split('/').pop()!,
					colours: unique(cells.map((cell) => getComputedStyle(cell).backgroundColor)),
					cellOpacities: unique(cells.map((cell) => round(effectiveOpacity(cell)))),
					labelOpacity: round(effectiveOpacity(link.querySelector('[data-map-label]')))
				};
			});
		}, OPACITY_DECIMALS);
}

// The token's value, resolved in the page. An undefined token would compute
// to opacity 1 and make "dimmed" indistinguishable from "full", so it fails.
export async function dimmedOpacity(page: Page): Promise<number> {
	const declared = await page.evaluate(
		(name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim(),
		DIMMED_TOKEN
	);
	expect(declared, `got no ${DIMMED_TOKEN} on :root, want the design token`).not.toBe('');
	const value = Number(await tokenValue(page, 'opacity', `var(${DIMMED_TOKEN})`));
	expect(value, `got ${DIMMED_TOKEN} ${value}, want it below 1`).toBeLessThan(1);
	return Number(value.toFixed(OPACITY_DECIMALS));
}

async function tileColours(page: Page): Promise<Map<string, string>> {
	const entries = await Promise.all(
		bundle.regions.map(
			async (region) =>
				[region.key, await tokenValue(page, 'background-color', region.tileColor)] as const
		)
	);
	return new Map(entries);
}

async function wantedLooks(page: Page, selectedKey: string | null): Promise<RegionLook[]> {
	const colours = await tileColours(page);
	const dimmed = selectedKey ? await dimmedOpacity(page) : 1;
	const looks = bundle.regions.map((region) => ({
		key: region.key,
		colours: [colours.get(region.key)!],
		cellOpacities: [!selectedKey || region.key === selectedKey ? 1 : dimmed],
		labelOpacity: 1
	}));
	return byKey(looks);
}

const byKey = (looks: RegionLook[]) => [...looks].sort((a, b) => a.key.localeCompare(b.key));

// Every region in its own tileColor; with a selection, every other region's
// cells dimmed; no label dimmed. Polls past the 200ms cell transition.
export async function expectMapSelection(page: Page, selectedKey: string | null) {
	const want = await wantedLooks(page, selectedKey);
	const what = selectedKey ? `${selectedKey} selected, the rest dimmed` : 'no region dimmed';
	await expect
		.poll(async () => byKey(await regionLooks(page)), { message: `want ${what}` })
		.toEqual(want);
}
