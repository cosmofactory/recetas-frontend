import { expect, test } from '../testutil/e2e-test';
import {
	enterState,
	gotoServerRender,
	LOCALES,
	NO_JS_STATES,
	skipUnlessLayout,
	stateTitle,
	UI_STATES
} from '../testutil/a11y-states-e2e';
import { describeUndersized, HIT_MIN_PX, undersizedTargets } from '../testutil/hit-area-e2e';

// FE-8 Accessibility: "Every interactive element is ≥ 44px, asserted
// globally" (both READMEs -> Accessibility: "All tap targets ≥ 44px tall in
// real build ... extend the hit area"). On every route type and overlay
// state (a11y-states-e2e.ts), in each locale (the Russian labels are the
// longest) and on both layouts, every visible, enabled interactive element
// has a hit area of at least 44×44 CSS px; how the hit area is measured and
// the one documented exception (FE-3: chips in a wrapping row) are in
// hit-area-e2e.ts.
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
			const tag = lang === 'en' ? ['@layout'] : [];
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
			test(`${title}: every target is ${page44}`, async ({ page }) => {
				await gotoServerRender(page, state, lang);
				const found = await undersizedTargets(page);
				expect(found, `got small hit areas on ${title}:\n${describeUndersized(found)}`).toEqual([]);
			});
		}
	}
});
