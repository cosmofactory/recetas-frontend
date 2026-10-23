import { test } from '../testutil/e2e-test';

// Positive control for the CSP guard on the `page` fixture
// (testutil/e2e-test.ts): a page whose policy blocks its own inline script
// must fail the test. The body asserts nothing, so the only expected failure
// is the fixture's; if the guard stopped seeing violations, this test would
// pass and test.fail() would report it.

const PROBE_PATH = '/__csp-guard-probe';
const PROBE_POLICY = "script-src 'none'";
const PROBE_HTML = '<!doctype html><title>probe</title><script>document.title = "ran";</script>';

// Tagged @cross-browser because each engine reports violations differently.
test(
	'the page fixture fails a test whose page has a CSP violation',
	{ tag: ['@cross-browser'] },
	async ({ page }) => {
		test.fail(true, 'the blocked inline script must fail the test via the page fixture');
		await page.route(`**${PROBE_PATH}`, (route) =>
			route.fulfill({
				contentType: 'text/html',
				headers: { 'content-security-policy': PROBE_POLICY },
				body: PROBE_HTML
			})
		);
		await page.goto(PROBE_PATH);
	}
);
