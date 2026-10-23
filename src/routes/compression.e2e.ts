import { expect, test, type TestInfo } from '../testutil/e2e-test';
import { getRaw, headerTokens } from '../testutil/e2e';

// FE-8 PR 4 (D-FE8-2, mobile LCP): the app gzips its own HTML, because
// adapter-node compresses only static files. This pins the wiring in
// hooks.server.ts `handle` against the production server: withGzip runs last,
// so the headers set before it survive. Plain HTTP, so one project.

const PROJECT = 'chromium-desktop-1280';
const PAGE = '/en/dishes/tortilla/gal';
const GZIP = { 'accept-encoding': 'gzip' };
const IDENTITY = { 'accept-encoding': 'identity' };

function onlyInOneProject(testInfo: TestInfo) {
	test.skip(testInfo.project.name !== PROJECT, `HTTP checks run in ${PROJECT} only`);
}

test('an HTML page is gzipped for a client that accepts it, keeping its other headers', async ({
	request
}, testInfo) => {
	onlyInOneProject(testInfo);
	const res = await getRaw(request, PAGE, GZIP);
	expect(res.status()).toBe(200);
	expect(res.headers()['content-encoding']).toBe('gzip');
	expect(headerTokens(res, 'vary')).toContain('accept-encoding');
	expect(res.headers()['cache-control'], 'Cache-Control survives the gzip').toBeTruthy();
	expect(res.headers()['x-robots-tag'], 'X-Robots-Tag survives the gzip').toBeTruthy();
	expect(res.headers()['content-security-policy'], 'CSP survives the gzip').toBeTruthy();
	expect(await res.text()).toContain('</html>');
});

test('an HTML page is sent as is to a client that does not accept gzip', async ({
	request
}, testInfo) => {
	onlyInOneProject(testInfo);
	const res = await getRaw(request, PAGE, IDENTITY);
	expect(res.headers()['content-encoding']).toBeUndefined();
	expect(headerTokens(res, 'vary')).toContain('accept-encoding');
});
