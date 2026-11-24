import { expect, test, type Page } from '../testutil/e2e-test';
import {
	enterState,
	gotoServerRender,
	LOCALES,
	mockDataTag,
	NO_JS_STATES,
	skipUnlessLayout,
	stateTitle,
	UI_STATES
} from '../testutil/a11y-states-e2e';
import {
	describeUndersized,
	HIT_MIN_PX,
	mapRegionsWithoutFullSizeTarget,
	undersizedTargets
} from '../testutil/hit-area-e2e';
import { REGION_COUNT } from '../testutil/map-regions-e2e';

// FE-8 Accessibility: "Every interactive element is ≥ 44px, asserted
// globally" (both READMEs -> Accessibility: "All tap targets ≥ 44px tall in
// real build ... extend the hit area"). On every route type and overlay
// state (a11y-states-e2e.ts), in each locale (the Russian labels are the
// longest) and on both layouts, every visible, enabled interactive element
// has a hit area of at least 44×44 CSS px; how the hit area is measured and
// the two documented exceptions (FE-3:89, extended in FE-8: chips in a
// wrapping row, filter and search suggestion chips alike; D-REG-1: map
// region tiles, each with a full-size equivalent) are in hit-area-e2e.ts.
//
// The English run is @layout: hit areas follow the width (Canarias' row
// height follows the map's width), so it also runs at 360/430 and 860/1440.
//
// Assumption (flagged in the FE-8 PR 5a report): the READMEs say "tall";
// this asks 44px on both axes, the WCAG 2.5.5 target size and the
// --hit-inset pattern's own contract (it grows "on each axis").

const page44 = `≥ ${HIT_MIN_PX}×${HIT_MIN_PX}px`;

test.describe(`hit areas ${page44} on every route and overlay state`, () => {
	for (const state of UI_STATES) {
		for (const lang of LOCALES) {
			const title = stateTitle(state, lang);
			const tag = [...(lang === 'en' ? ['@layout'] : []), ...mockDataTag(state)];
			test(`${title}: every target is ${page44}`, { tag }, async ({ page }) => {
				skipUnlessLayout(page, state.layouts);
				await enterState(page, state, lang);
				const found = await undersizedTargets(page);
				expect(found, `got small hit areas on ${title}:\n${describeUndersized(found)}`).toEqual([]);
			});
		}
	}
});

test.describe(`hit areas ${page44} in the server render without JavaScript`, () => {
	for (const state of NO_JS_STATES) {
		for (const lang of LOCALES) {
			const title = `${stateTitle(state, lang)} (no JavaScript)`;
			test(`${title}: every target is ${page44}`, { tag: mockDataTag(state) }, async ({ page }) => {
				await gotoServerRender(page, state, lang);
				const found = await undersizedTargets(page);
				expect(found, `got small hit areas on ${title}:\n${describeUndersized(found)}`).toEqual([]);
			});
		}
	}
});

// D-REG-1 (owner, 2026-11-23): map tiles are exempt from 44px because every
// region keeps a full-size target elsewhere: on mobile the region chip row
// under the map, on desktop the panel's empty-state chips (the bare home,
// where no region is selected). Checked on the bare home, with and without
// JavaScript (the chips are links), on both layouts.
const HOME_REGIONAL = UI_STATES.find((state) => state.name === 'home Regional')!;

async function expectEveryRegionTwinned(page: Page) {
	const { mapRegions, missing } = await mapRegionsWithoutFullSizeTarget(page);
	expect(mapRegions, `got ${mapRegions} map regions on screen`).toBe(REGION_COUNT);
	expect(missing, `got map regions with no full-size twin:\n${missing.join('\n')}`).toEqual([]);
}

test.describe('D-REG-1: every map region has a full-size equivalent target', () => {
	for (const lang of LOCALES) {
		const title = stateTitle(HOME_REGIONAL, lang);
		const tag = lang === 'en' ? ['@layout'] : [];
		test(`${title}: each map region has a ${page44} link to its URL`, { tag }, async ({ page }) => {
			await enterState(page, HOME_REGIONAL, lang);
			await expectEveryRegionTwinned(page);
		});

		test(`${title} (no JavaScript): each map region has a ${page44} link to its URL`, async ({
			page
		}) => {
			await gotoServerRender(page, HOME_REGIONAL, lang);
			await expectEveryRegionTwinned(page);
		});
	}
});
