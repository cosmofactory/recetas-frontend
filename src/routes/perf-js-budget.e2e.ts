import { gzipSync } from 'node:zlib';
import { expect, test, type Page, type Response, type TestInfo } from '../testutil/e2e-test';
import { LOCALES } from '../testutil/e2e';
import { BUDGETED_PATHS, JS_GZIP_BUDGET_BYTES } from '../testutil/perf-budgets';

// FE-8 PR 4, D-FE8-2: ≤ 90 KB of gzip JavaScript on the initial load of the
// home, Variations and Recipe pages, in every locale (stack.md F4
// "Performance budgets").
//
// Decisions pinned here:
// - The size is each JavaScript response body (decoded) gzipped here at
//   one fixed level, never the transfer size: adapter-node serves brotli,
//   which would understate it, and a dev cache could hide it.
// - "Initial load" is everything fetched until the network is idle, so
//   chunks the page imports lazily while it starts up count too.
// - A JavaScript response is one whose Content-Type is JavaScript (modules,
//   modulepreloads, workers). Kit's inline bootstrap <script> is part of
//   the HTML, not a response, so it doesn't count.
// - The client bundle is the same at every width (one page per route, CSS
//   switches the layout, no width-dependent imports), so one project.

const PROJECT = 'chromium-mobile-390';
const GZIP_LEVEL = 6;
const JAVASCRIPT_TYPE = /javascript/i;
const BYTES_PER_KB = 1024;

type ScriptSize = { url: string; gzipBytes: number };

function onlyInOneProject(testInfo: TestInfo) {
	test.skip(testInfo.project.name !== PROJECT, `JS budget runs in ${PROJECT} only`);
}

function isJavaScript(response: Response): boolean {
	return JAVASCRIPT_TYPE.test(response.headers()['content-type'] ?? '');
}

function collectScripts(page: Page): Response[] {
	const scripts: Response[] = [];
	page.on('response', (response) => {
		if (isJavaScript(response)) scripts.push(response);
	});
	return scripts;
}

async function gzipSize(response: Response): Promise<ScriptSize> {
	const body = await response.body();
	return { url: response.url(), gzipBytes: gzipSync(body, { level: GZIP_LEVEL }).length };
}

async function initialLoadScripts(page: Page, url: string): Promise<ScriptSize[]> {
	const responses = collectScripts(page);
	const res = await page.goto(url, { waitUntil: 'networkidle' });
	expect(res?.status(), `got status ${res?.status()} for ${url}, want 200`).toBe(200);
	const unique = [...new Map(responses.map((r) => [r.url(), r])).values()];
	return Promise.all(unique.map(gzipSize));
}

const totalBytes = (scripts: ScriptSize[]) => scripts.reduce((sum, s) => sum + s.gzipBytes, 0);

const kb = (bytes: number) => `${(bytes / BYTES_PER_KB).toFixed(1)} KB`;

function report(scripts: ScriptSize[]): string {
	const rows = [...scripts]
		.sort((a, b) => b.gzipBytes - a.gzipBytes)
		.map((s) => `  ${kb(s.gzipBytes).padStart(9)}  ${new URL(s.url).pathname}`);
	const total = totalBytes(scripts);
	return [`${kb(total)} (${total} B) in ${scripts.length} scripts (gzip):`, ...rows].join('\n');
}

test.describe('JS budget: gzip JavaScript on initial load', () => {
	for (const lang of LOCALES) {
		for (const path of BUDGETED_PATHS) {
			const url = `/${lang}${path}`;
			test(`${url}: ≤ ${kb(JS_GZIP_BUDGET_BYTES)} of gzip JS`, async ({ page }, testInfo) => {
				onlyInOneProject(testInfo);
				const scripts = await initialLoadScripts(page, url);
				const total = totalBytes(scripts);
				await testInfo.attach('js-sizes', { body: report(scripts), contentType: 'text/plain' });
				expect(scripts.length, `got no JavaScript responses on ${url}, want some`).toBeGreaterThan(
					0
				);
				expect(
					total,
					`got ${kb(total)} of gzip JS on ${url}, want ≤ ${kb(JS_GZIP_BUDGET_BYTES)} (${JS_GZIP_BUDGET_BYTES} B)\n${report(scripts)}`
				).toBeLessThanOrEqual(JS_GZIP_BUDGET_BYTES);
			});
		}
	}
});
