import { expect, test as base, type Page } from '@playwright/test';
import { watchCspViolations } from './csp-e2e';

// The `test` every E2E spec imports (instead of @playwright/test's): the
// same API, plus a CSP guard on the `page` fixture. Any test that uses `page`
// fails if a Content-Security-Policy violation happened while it ran (FE-8
// acceptance: "no CSP violations across the e2e suite"). Pages opened with
// context.newPage() are not watched; use `page`.

export * from '@playwright/test';

// A navigation still in flight when the test ends destroys the context the
// flush runs in; the new document has nothing pending yet, so that's fine.
const NAVIGATION_RACE = /Execution context was destroyed/;

// `securitypolicyviolation` is dispatched in a later task than the blocked
// load, and its report reaches the runner through an async binding, so let
// the page run one more task before reading the list. Skipped without
// JavaScript: the page's timers never fire, so the flush would hang.
async function flushPendingViolations(page: Page): Promise<void> {
	if (page.isClosed()) return;
	try {
		await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 0)));
	} catch (err) {
		if (page.isClosed() || NAVIGATION_RACE.test(String(err))) return;
		throw err;
	}
}

export const test = base.extend({
	page: async ({ page, javaScriptEnabled }, use) => {
		const violations = await watchCspViolations(page);
		await use(page);
		if (javaScriptEnabled) await flushPendingViolations(page);
		expect(violations, `got CSP violations ${JSON.stringify(violations)}, want none`).toEqual([]);
	}
});
