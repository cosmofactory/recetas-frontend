import { expect, test as base } from '@playwright/test';
import { watchCspViolations } from './csp-e2e';

// The `test` every E2E spec imports (instead of @playwright/test's): the
// same API, plus a CSP guard on the `page` fixture. Any test that uses `page`
// fails if a Content-Security-Policy violation happened while it ran (FE-8
// acceptance: "no CSP violations across the e2e suite"). Pages opened with
// context.newPage() are not watched; use `page`.

export * from '@playwright/test';

export const test = base.extend({
	page: async ({ page }, use) => {
		const violations = await watchCspViolations(page);
		await use(page);
		expect(violations, `got CSP violations ${JSON.stringify(violations)}, want none`).toEqual([]);
	}
});
