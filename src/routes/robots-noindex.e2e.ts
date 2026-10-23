import { expect, test, type TestInfo } from '../testutil/e2e-test';
import { getRaw } from '../testutil/e2e';
import { TARGET_APP_ENV } from '../testutil/e2e-app-env';
import { EXTERNAL_BASE_URL } from '../testutil/e2e-target';

// FE-8 PR 1 acceptance ("Demo responds with noindex and robots disallows
// everything. A local prod-mode build is indexable"). Plain HTTP, no browser
// behaviour, so one project. Which mode is expected (TARGET_APP_ENV):
// - locally, the E2E server's APP_ENV=demo (playwright.config.ts);
// - against a deployment (E2E_BASE_URL), demo by default, the nightly
//   target; set E2E_APP_ENV=prod to check the production site instead
//   (robots allows everything and names the sitemap, no noindex header).
// The prod mode is also pinned by robots.txt/server.spec.ts and
// hooks.server.robots.spec.ts.

const PROJECT = 'chromium-desktop-1280';
const indexable = TARGET_APP_ENV === 'prod';

function onlyInOneProject(testInfo: TestInfo) {
	test.skip(testInfo.project.name !== PROJECT, `HTTP checks run in ${PROJECT} only`);
}

const directives = (body: string) =>
	body
		.split('\n')
		.map((line) => line.replace(/#.*/, '').trim())
		.filter(Boolean);

const robotsRule = indexable ? 'Allow: /' : 'Disallow: /';

test.describe(`APP_ENV=${TARGET_APP_ENV}: robots.txt`, () => {
	test(`/robots.txt says "${robotsRule}", as text/plain`, async ({ request }, testInfo) => {
		onlyInOneProject(testInfo);
		const res = await getRaw(request, '/robots.txt');
		expect(res.status(), `got ${res.status()}, want 200`).toBe(200);
		expect(res.headers()['content-type'] ?? '').toMatch(/^text\/plain\b/);
		const lines = directives(await res.text());
		expect(lines, `got ${JSON.stringify(lines)}`).toContain('User-agent: *');
		expect(lines, `got ${JSON.stringify(lines)}, want "${robotsRule}"`).toContain(robotsRule);
		const sitemap = lines.some((line) => line.startsWith('Sitemap:'));
		expect(sitemap, `got ${JSON.stringify(lines)}, want a Sitemap line only on prod`).toBe(
			indexable
		);
	});
});

const noindexWant = indexable ? 'no noindex' : 'noindex';

test.describe(`APP_ENV=${TARGET_APP_ENV}: X-Robots-Tag on every response`, () => {
	const responses: { url: string; status: number; localOnly?: boolean }[] = [
		{ url: '/en/', status: 200 },
		{ url: '/es/?tab=popular', status: 200 },
		{ url: '/ru/regions/gal', status: 200 },
		{ url: '/en/dishes/tortilla', status: 200 },
		{ url: '/es/dishes/tortilla/gal', status: 200 },
		{ url: '/robots.txt', status: 200 },
		{ url: '/healthz', status: 200 },
		// No backend in mock mode: /readyz is 503 (a deployment has one).
		{ url: '/readyz', status: 503, localOnly: true },
		{ url: '/fr/', status: 404 },
		{ url: '/en/dishes/no-such-dish', status: 404 },
		{ url: '/es/no/such/page', status: 404 }
	];
	for (const { url, status, localOnly } of responses) {
		test(`${url} (${status}) carries ${noindexWant}`, async ({ request }, testInfo) => {
			onlyInOneProject(testInfo);
			test.skip(localOnly === true && EXTERNAL_BASE_URL !== undefined, 'mock mode only');
			const res = await getRaw(request, url);
			expect(res.status(), `got ${res.status()}, want ${status}`).toBe(status);
			const tag = res.headers()['x-robots-tag'] ?? '';
			const got = tag.split(',').map((d) => d.trim());
			expect(
				got.includes('noindex'),
				`got X-Robots-Tag ${JSON.stringify(tag)}, want ${noindexWant}`
			).toBe(!indexable);
		});
	}
});
