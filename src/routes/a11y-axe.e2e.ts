import { test } from '../testutil/e2e-test';
import {
	BOTH,
	crossBrowserTag,
	enterState,
	gotoServerRender,
	LOCALES,
	NO_JS_STATES,
	skipUnlessLayout,
	stateTitle,
	UI_STATES,
	type UiState
} from '../testutil/a11y-states-e2e';
import { freePort, startAppServer, type AppServer } from '../testutil/app-server-e2e';
import { expectNoViolations } from '../testutil/axe-e2e';
import { skipAgainstDeployment } from '../testutil/e2e-target';

// FE-8 Accessibility: "Run @axe-core/playwright on every route type, in all
// three locales, on mobile and desktop layouts, with sheets and overlays
// both open and closed. CI fails on any violation." (stack.md X10: WCAG 2.2
// AA; the scan is the shared expectNoViolations, WCAG 2.0–2.2 A/AA tags plus
// the landmark rules.) One table (a11y-states-e2e.ts) drives every scan; the
// layout comes from the project (chromium-mobile-390, chromium-desktop-1280),
// and a small English subset also runs on WebKit and Firefox (@cross-browser).
// The older per-feature scans stay until PR 5b consolidates them.

test.describe('axe: every route and overlay state', () => {
	for (const state of UI_STATES) {
		for (const lang of LOCALES) {
			const title = stateTitle(state, lang);
			const tag = crossBrowserTag(state, lang);
			test(`${title} has no violations`, { tag }, async ({ page }) => {
				skipUnlessLayout(page, state.layouts);
				await enterState(page, state, lang);
				await expectNoViolations(page, title);
			});
		}
	}
});

// The server render on its own: what a crawler, a slow connection or a
// JavaScript failure gets (the language menu is a plain <details> then).
test.describe('axe: the server render without JavaScript', () => {
	for (const state of NO_JS_STATES) {
		for (const lang of LOCALES) {
			const title = `${stateTitle(state, lang)} (no JavaScript)`;
			test(`${title} has no violations`, async ({ page }) => {
				await gotoServerRender(page, state, lang);
				await expectNoViolations(page, title);
			});
		}
	}
});

// The 503 page (backend down) needs its own server: DATA_SOURCE=api with
// BACKEND_API_BASE_URL on a closed port, as in error-pages-prod.e2e.ts.
const UNAVAILABLE = 503;
const UNAVAILABLE_STATE: UiState = {
	name: '503 page (backend down)',
	path: '/dishes/tortilla',
	layouts: BOTH,
	status: UNAVAILABLE
};

test.describe('axe: the 503 page', () => {
	skipAgainstDeployment('starts its own node build with the backend down');
	let app: AppServer | undefined;

	test.beforeAll(async () => {
		const backend = `http://127.0.0.1:${await freePort()}`;
		app = await startAppServer({ DATA_SOURCE: 'api', BACKEND_API_BASE_URL: backend });
	});
	test.afterAll(async () => {
		await app?.stop();
	});

	for (const lang of LOCALES) {
		const title = stateTitle(UNAVAILABLE_STATE, lang);
		test(`${title} has no violations`, async ({ page }) => {
			await enterState(page, UNAVAILABLE_STATE, lang, app!.baseURL);
			await expectNoViolations(page, title);
		});
	}
});
