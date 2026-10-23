import { readFileSync } from 'node:fs';
import { expect, test, type APIResponse, type TestInfo } from '../testutil/e2e-test';
import {
	freePort,
	startAppServer,
	startAppWithBackend,
	type AppServer
} from '../testutil/app-server-e2e';
import { getRaw, headerTokens, LOCALES, type Locale } from '../testutil/e2e';
import { skipAgainstDeployment } from '../testutil/e2e-target';

skipAgainstDeployment('starts its own node build with a broken or stopped backend');

// FE-8 PR 3, Security: "Error pages don't leak anything in production",
// against the production build (`node build`) with DATA_SOURCE=api.
// - A 500 (an unexpected error): the API answers 400, which api-source.ts
//   turns into a plain Error whose message names the backend URL; that is a
//   bug path (handleError logs it), so the client sees only Kit's generic
//   message and the localised "something went wrong" copy.
// - A 503 (backend down): BACKEND_API_BASE_URL points at a closed port; the
//   page shows the localised body and nothing about the backend.
// Neither the HTML nor the page's __data.json may hold the internal message,
// the backend origin, a stack frame, a source path or a route id.
// handleError's own contract is pinned in hooks.server.spec.ts.
//
// Decision pinned here: both error responses are `no-store`, never public
// (see cache-control.e2e.ts), and still carry the CSP.

const PROJECT = 'chromium-desktop-1280';
const SECRET_DETAIL = 'secret-backend-detail';
const BAD_REQUEST = 400;
const PATHS = ['/', '/dishes/tortilla', '/dishes/tortilla/gal'];

type Messages = Record<string, string>;

function messages(locale: Locale): Messages {
	return JSON.parse(readFileSync(`messages/${locale}.json`, 'utf8')) as Messages;
}

function onlyInOneProject(testInfo: TestInfo) {
	test.skip(testInfo.project.name !== PROJECT, `HTTP checks run in ${PROJECT} only`);
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Text that only an internal error, the server's config or its source could
// put in a response.
function leaksIn(text: string, backendOrigin: string): string[] {
	const patterns: [string, RegExp][] = [
		['the backend host:port', new RegExp(escapeRegExp(new URL(backendOrigin).host))],
		['the internal message', /backend answered|backend unreachable|fetch failed|ECONNREFUSED/],
		['the backend body', new RegExp(SECRET_DETAIL)],
		['an API path', /\/v1\/(regions|dishes)/],
		['an error class', /\b(TypeError|UnavailableError|NotFoundError)\b/],
		['a stack frame', /\bat \S+ \(|\.(ts|js|svelte):\d+:\d+/],
		['a source path', /node_modules|src\/(lib|routes)\//],
		['a route id', /\[lang=lang\]|\+page|\+layout/]
	];
	return patterns.filter(([, re]) => re.test(text)).map(([what]) => what);
}

async function expectNoLeaks(res: APIResponse, backendOrigin: string) {
	const found = leaksIn(await res.text(), backendOrigin);
	expect(found, `got ${found.join(', ')} in ${res.url()} (${res.status()}), want none`).toEqual([]);
}

async function expectServerErrorCopy(res: APIResponse, locale: Locale) {
	const html = await res.text();
	const copy = messages(locale);
	for (const key of ['errors_serverErrorTitle', 'errors_serverErrorBody']) {
		expect(html, `got no ${key} "${copy[key]}" on ${res.url()}`).toContain(copy[key]);
	}
}

function expectErrorHeaders(res: APIResponse) {
	const cache = headerTokens(res, 'cache-control');
	expect(cache, `got Cache-Control ${JSON.stringify(cache)}, want no-store`).toContain('no-store');
	expect(cache, `got Cache-Control ${JSON.stringify(cache)}, want never public`).not.toContain(
		'public'
	);
	const csp = res.headers()['content-security-policy'];
	expect(csp, 'got no Content-Security-Policy on the error page, want one').toBeTruthy();
}

type Scenario = { name: string; status: number; start: () => Promise<Started> };
type Started = { app: AppServer; backendOrigin: string; stop: () => Promise<void> };

async function withBrokenBackend(): Promise<Started> {
	const { app, backend, stop } = await startAppWithBackend((_req, res) => {
		res.writeHead(BAD_REQUEST, { 'content-type': 'application/json' });
		res.end(JSON.stringify({ title: SECRET_DETAIL }));
	});
	return { app, backendOrigin: backend.baseURL, stop };
}

async function withBackendDown(): Promise<Started> {
	const backendOrigin = `http://127.0.0.1:${await freePort()}`;
	const app = await startAppServer({ DATA_SOURCE: 'api', BACKEND_API_BASE_URL: backendOrigin });
	return { app, backendOrigin, stop: app.stop };
}

const SCENARIOS: Scenario[] = [
	{ name: '500 (an unexpected error)', status: 500, start: withBrokenBackend },
	{ name: '503 (backend down)', status: 503, start: withBackendDown }
];

for (const scenario of SCENARIOS) {
	test.describe(`production error page: ${scenario.name}`, () => {
		let started: Started | undefined;

		test.beforeAll(async () => {
			if (test.info().project.name !== PROJECT) return;
			started = await scenario.start();
		});
		test.afterAll(async () => {
			await started?.stop();
		});

		for (const locale of LOCALES) {
			for (const path of PATHS) {
				const url = `/${locale}${path}`;

				test(`${url}: ${scenario.status}, localised copy, nothing internal`, async ({
					request
				}, testInfo) => {
					onlyInOneProject(testInfo);
					const res = await getRaw(request, `${started!.app.baseURL}${url}`);
					expect(res.status(), `got ${res.status()}, want ${scenario.status}`).toBe(
						scenario.status
					);
					await expectServerErrorCopy(res, locale);
					await expectNoLeaks(res, started!.backendOrigin);
					expectErrorHeaders(res);
				});
			}
		}

		test('the data endpoint leaks nothing either', async ({ request }, testInfo) => {
			onlyInOneProject(testInfo);
			const res = await getRaw(request, `${started!.app.baseURL}/en/dishes/tortilla/__data.json`);
			await expectNoLeaks(res, started!.backendOrigin);
		});
	});
}
