import { expect, test, type TestInfo } from '@playwright/test';
import { getRaw } from '../testutil/e2e';
import { APP_ENV } from '../testutil/e2e-app-env';

// FE-8 PR 1 acceptance ("Demo responds with noindex and robots disallows
// everything"), against the production server, which runs with APP_ENV=demo
// (playwright.config.ts). Plain HTTP, no browser behaviour, so one project.
// The prod mode is pinned by robots.txt/server.spec.ts and
// hooks.server.robots.spec.ts.

const PROJECT = 'chromium-desktop-1280';

function onlyInOneProject(testInfo: TestInfo) {
	test.skip(testInfo.project.name !== PROJECT, `HTTP checks run in ${PROJECT} only`);
}

const directives = (body: string) =>
	body
		.split('\n')
		.map((line) => line.replace(/#.*/, '').trim())
		.filter(Boolean);

test.describe(`APP_ENV=${APP_ENV}: robots.txt`, () => {
	test('/robots.txt disallows everything, as text/plain', async ({ request }, testInfo) => {
		onlyInOneProject(testInfo);
		const res = await getRaw(request, '/robots.txt');
		expect(res.status(), `got ${res.status()}, want 200`).toBe(200);
		expect(res.headers()['content-type'] ?? '').toMatch(/^text\/plain\b/);
		const lines = directives(await res.text());
		expect(lines, `got ${JSON.stringify(lines)}`).toContain('User-agent: *');
		expect(lines, `got ${JSON.stringify(lines)}, want "Disallow: /"`).toContain('Disallow: /');
	});
});

test.describe(`APP_ENV=${APP_ENV}: X-Robots-Tag on every response`, () => {
	const responses: { url: string; status: number }[] = [
		{ url: '/en/', status: 200 },
		{ url: '/es/?tab=popular', status: 200 },
		{ url: '/ru/regions/gal', status: 200 },
		{ url: '/en/dishes/tortilla', status: 200 },
		{ url: '/es/dishes/tortilla/gal', status: 200 },
		{ url: '/robots.txt', status: 200 },
		{ url: '/healthz', status: 200 },
		// No backend in mock mode: /readyz is 503.
		{ url: '/readyz', status: 503 },
		{ url: '/fr/', status: 404 },
		{ url: '/en/dishes/no-such-dish', status: 404 },
		{ url: '/es/no/such/page', status: 404 }
	];
	for (const { url, status } of responses) {
		test(`${url} (${status}) carries X-Robots-Tag: noindex`, async ({ request }, testInfo) => {
			onlyInOneProject(testInfo);
			const res = await getRaw(request, url);
			expect(res.status(), `got ${res.status()}, want ${status}`).toBe(status);
			const tag = res.headers()['x-robots-tag'] ?? '';
			const got = tag.split(',').map((d) => d.trim());
			expect(got, `got X-Robots-Tag ${JSON.stringify(tag)}, want noindex`).toContain('noindex');
		});
	}
});
