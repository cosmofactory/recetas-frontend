import type { RequestListener } from 'node:http';
import { expect, test, type Page, type TestInfo } from '../testutil/e2e-test';
import { startAppWithBackend, type AppWithBackend } from '../testutil/app-server-e2e';
import { catalogBackend } from '../testutil/catalog-backend-e2e';
import { getRaw, htmlLang, LOCALES, localePath, PAGES } from '../testutil/e2e';
import { skipAgainstDeployment } from '../testutil/e2e-target';
import { gotoHydrated } from '../testutil/home-e2e';
import { clientNavigate } from '../testutil/recipe-e2e';

// FE-2 acceptance, against a second `node build` with DATA_SOURCE=api reading
// a fake Go API that serves the vendored bundle (testutil/catalog-backend-e2e.ts):
// - "the same pages render from the API, and the browser network log shows
//   no requests to the API host" (stack.md X4: the browser never calls the
//   Go API; client navigations load data through the app's __data.json);
// - "/readyz returns 200 with the backend up and 503 with it stopped".
// The server-side checks are plain HTTP, so they run in one project; the
// browser check runs on both core layouts (mobile and desktop load the same
// data, but through different screens).

const HTTP_PROJECT = 'chromium-desktop-1280';
const OK = 200;
const SERVICE_UNAVAILABLE = 503;
const BACKEND_HEALTH_PATH = '/healthz';

function onlyInHttpProject(testInfo: TestInfo) {
	test.skip(testInfo.project.name !== HTTP_PROJECT, `HTTP checks run in ${HTTP_PROJECT} only`);
}

type CountingBackend = { handler: RequestListener; received: () => string[] };

// The catalog fake plus the backend /healthz /readyz asks; records every path.
function countingCatalogBackend(): CountingBackend {
	const catalog = catalogBackend({});
	const received: string[] = [];
	const handler: RequestListener = (req, res) => {
		received.push(req.url ?? '');
		if (req.url === BACKEND_HEALTH_PATH) {
			res.writeHead(OK, { 'content-type': 'application/json' });
			res.end('{"status":"ok"}');
			return;
		}
		catalog(req, res);
	};
	return { handler, received: () => [...received] };
}

// Every request the page makes from now on, as full URLs.
function recordRequests(page: Page): string[] {
	const urls: string[] = [];
	page.on('request', (request) => urls.push(request.url()));
	return urls;
}

async function clientNavigateTo(page: Page, path: string) {
	await clientNavigate(page, path);
	await page.waitForURL((url) => url.pathname === path);
	await page.waitForLoadState('networkidle');
}

test.describe('DATA_SOURCE=api: pages render from the Go API', () => {
	skipAgainstDeployment('starts its own node build against a fake API');
	let started: AppWithBackend | undefined;
	let backend: CountingBackend | undefined;

	test.beforeAll(async () => {
		backend = countingCatalogBackend();
		started = await startAppWithBackend(backend.handler);
	});
	test.afterAll(async () => {
		await started?.stop();
	});

	for (const p of PAGES) {
		for (const locale of LOCALES) {
			const url = localePath(locale, p.path);
			test(`${url} renders ${p.name} server-side from the API`, async ({ request }, testInfo) => {
				onlyInHttpProject(testInfo);
				const res = await getRaw(request, `${started!.app.baseURL}${url}`);
				expect(res.status(), `got status ${res.status()}, want 200`).toBe(OK);
				const html = await res.text();
				expect(htmlLang(html)).toBe(locale);
				expect(html, `got no "${p.text[locale]}" in the HTML`).toContain(p.text[locale]);
			});
		}
	}

	test('the API answered the app: it got catalog requests', async ({ request }, testInfo) => {
		onlyInHttpProject(testInfo);
		await getRaw(request, `${started!.app.baseURL}/es/dishes/tortilla`);
		const catalogCalls = backend!.received().filter((path) => path.startsWith('/v1/'));
		expect(catalogCalls.length, 'got no /v1/ request at the fake API').toBeGreaterThan(0);
	});

	test('the browser never calls the API: load, then client navigations', async ({ page }) => {
		const app = started!.app.baseURL;
		const requests = recordRequests(page);
		await gotoHydrated(page, `${app}/en/`);
		for (const path of ['/en/regions/gal', '/en/dishes/tortilla', '/en/dishes/tortilla/gal']) {
			await clientNavigateTo(page, path);
		}
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Betanzos-style runny');
		const elsewhere = requests.filter((url) => new URL(url).origin !== app);
		expect(elsewhere, `got requests off the app origin ${app}`).toEqual([]);
		const toBackend = requests.filter((url) => url.startsWith(started!.backend.baseURL));
		expect(toBackend, 'got browser requests to the API host').toEqual([]);
	});
});

test.describe('/readyz follows the backend', () => {
	skipAgainstDeployment('starts its own node build and stops its fake API');
	let started: AppWithBackend | undefined;

	test.beforeAll(async () => {
		if (test.info().project.name !== HTTP_PROJECT) return;
		started = await startAppWithBackend(countingCatalogBackend().handler);
	});
	test.afterAll(async () => {
		await started?.stop();
	});

	test('200 with the backend up, 503 once it stops', async ({ request }, testInfo) => {
		onlyInHttpProject(testInfo);
		const readyz = `${started!.app.baseURL}/readyz`;
		const up = await getRaw(request, readyz);
		expect(up.status(), `got ${up.status()} with the backend up, want 200`).toBe(OK);
		await started!.backend.stop();
		const down = await getRaw(request, readyz);
		expect(down.status(), `got ${down.status()} with the backend stopped, want 503`).toBe(
			SERVICE_UNAVAILABLE
		);
	});
});
