import { expect, test, type APIResponse, type Page, type TestInfo } from '../testutil/e2e-test';
import {
	startAppServer,
	startAppWithBackend,
	type AppServer,
	type AppWithBackend
} from '../testutil/app-server-e2e';
import { catalogBackend } from '../testutil/catalog-backend-e2e';
import {
	effectiveSources,
	executableInlineScripts,
	isHash,
	isHostOrScheme,
	isNonce,
	nonceValue,
	parseCsp,
	sha256Source,
	type Csp
} from '../testutil/csp';
import { getRaw } from '../testutil/e2e';
import { gotoHydrated, isDesktopPage } from '../testutil/home-e2e';
import { menuRow, openMenu } from '../testutil/language-menu-e2e';
import { dishCard, dishSheet, sidebarChip } from '../testutil/popular-e2e';
import { ingredientRows, moreButton, stepRows } from '../testutil/recipe-e2e';
import { expectSheetPeek, tapRegion } from '../testutil/region-e2e';
import { DISHES, resultGroup, searchFor } from '../testutil/search-e2e';
import { searchDropdown, typeInDesktopSearch } from '../testutil/desktop-search-e2e';
import { loadedImagesFrom, stubMediaHost } from '../testutil/media-e2e';
import { variationCards } from '../testutil/variations-e2e';

// FE-8 PR 3, Security: the Content-Security-Policy (stage FE-8 -> Security,
// D-FE8-1: SvelteKit owns the CSP, `kit.csp` in mode 'auto'; Caddy (INF-5)
// owns HSTS, X-Content-Type-Options, Referrer-Policy and Permissions-Policy,
// so the app must not send those). Acceptance: "A CSP header is present and
// the console shows no CSP violations across the e2e suite"; every spec's
// `page` fixture fails on a violation (testutil/e2e-test.ts), and the tours
// below walk the key flows on both layouts.
//
// Decisions pinned here:
// - Every HTML response the app renders (pages and error pages) carries an
//   enforced `Content-Security-Policy` (not Report-Only).
// - Fixed directives, exactly: default-src 'self'; font-src 'self';
//   connect-src 'self'; frame-ancestors 'none'; base-uri 'self';
//   form-action 'self'; object-src 'none'.
// - img-src is 'self' plus the MEDIA_BASE_URL origin when it is set, read at
//   RUNTIME (kit.csp is fixed at build time, so the server must add it per
//   response). No `data:`: fonts and the favicon are emitted as files, never
//   inlined (assetsInlineLimit). No other host or scheme.
// - script-src: 'self' (or 'strict-dynamic') plus Kit's nonce or hashes,
//   never 'unsafe-inline' / 'unsafe-eval' / a host; every executable inline
//   script carries the header's nonce or its hash is listed; a nonce is
//   fresh per response.
// - Styles: the server HTML has style attributes (app.html's
//   `style="display: contents"`, map tiles' --tile-color and grid cells,
//   <Photo> height/radius), which no nonce or hash can allow. So the
//   narrowest working policy is `style-src-attr 'unsafe-inline'` with
//   <style>/<link> elements still limited to 'self' (+ Kit's nonce/hashes):
//   style-src (or style-src-elem) has no 'unsafe-inline'. Runtime `style:`
//   directives and transitions go through the CSSOM / Web Animations, which
//   CSP does not govern.

const PROJECT = 'chromium-desktop-1280';
// The in-browser tours check engine behaviour; the header tests stay in PROJECT.
const CROSS_BROWSER = { tag: ['@cross-browser'] };
const MEDIA_ORIGIN = 'https://media.example.test';
const MEDIA_BASE_URL = `${MEDIA_ORIGIN}/media`;

const HTML_RESPONSES: { url: string; status: number }[] = [
	{ url: '/en/', status: 200 },
	{ url: '/es/?tab=popular', status: 200 },
	{ url: '/ru/regions/gal', status: 200 },
	{ url: '/en/dishes/tortilla', status: 200 },
	{ url: '/es/dishes/tortilla/gal', status: 200 },
	{ url: '/fr/', status: 404 },
	{ url: '/en/dishes/no-such-dish', status: 404 }
];

const FIXED_DIRECTIVES: [string, string[]][] = [
	['default-src', ["'self'"]],
	['font-src', ["'self'"]],
	['connect-src', ["'self'"]],
	['frame-ancestors', ["'none'"]],
	['base-uri', ["'self'"]],
	['form-action', ["'self'"]],
	['object-src', ["'none'"]]
];

// Caddy's headers (D-FE8-1, INF-5); the app must never send them.
const PROXY_HEADERS = [
	'strict-transport-security',
	'x-content-type-options',
	'referrer-policy',
	'permissions-policy'
];

function onlyInOneProject(testInfo: TestInfo) {
	test.skip(testInfo.project.name !== PROJECT, `HTTP checks run in ${PROJECT} only`);
}

function policyOf(res: APIResponse): Csp {
	const header = res.headers()['content-security-policy'];
	expect(header, `got no Content-Security-Policy on ${res.url()}, want one`).toBeTruthy();
	return parseCsp(header);
}

async function fetchPolicy(baseURL: string, request: Parameters<typeof getRaw>[0], url: string) {
	const res = await getRaw(request, new URL(url, baseURL).href);
	return { res, csp: policyOf(res), html: await res.text() };
}

const sorted = (values: string[] | undefined) => [...(values ?? [])].sort();

function expectImgSrc(csp: Csp, media: string[]) {
	const got = csp.get('img-src');
	expect(got, `got no img-src, want 'self' ${media.join(' ')}`).toBeDefined();
	const allowed = new Set(["'self'", ...media]);
	const extra = got!.filter((s) => !allowed.has(s));
	expect(extra, `got img-src ${JSON.stringify(got)}, want only 'self' ${media}`).toEqual([]);
	for (const source of ["'self'", ...media]) {
		expect(got, `got img-src ${JSON.stringify(got)}, want ${source}`).toContain(source);
	}
}

function scriptSources(csp: Csp): string[] {
	const got = csp.get('script-src');
	expect(got, 'got no script-src, want one with Kit nonces or hashes').toBeDefined();
	return got!;
}

function expectStrictScriptSrc(csp: Csp) {
	const got = scriptSources(csp);
	const what = `script-src ${JSON.stringify(got)}`;
	expect(
		got.some((s) => isNonce(s) || isHash(s)),
		`got ${what}, want a nonce or hash`
	).toBe(true);
	expect(
		got.includes("'self'") || got.includes("'strict-dynamic'"),
		`got ${what}, want 'self'`
	).toBe(true);
	for (const banned of ["'unsafe-inline'", "'unsafe-eval'", "'unsafe-hashes'"]) {
		expect(got, `got ${what}, want no ${banned}`).not.toContain(banned);
	}
	expect(got.filter(isHostOrScheme), `got ${what}, want no host or scheme`).toEqual([]);
}

function expectInlineScriptsAllowed(csp: Csp, html: string) {
	const sources = scriptSources(csp);
	const nonces = sources.filter(isNonce).map(nonceValue);
	const scripts = executableInlineScripts(html);
	expect(scripts.length, 'want Kit’s inline boot script in the HTML').toBeGreaterThan(0);
	for (const { attrs, content } of scripts) {
		const allowed = nonces.includes(attrs.nonce ?? '') || sources.includes(sha256Source(content));
		expect(allowed, `got inline script ${content.slice(0, 60)}… not allowed by the CSP`).toBe(true);
	}
}

function expectNarrowStyles(csp: Csp) {
	const attr = csp.get('style-src-attr');
	expect(sorted(attr), "want style-src-attr 'unsafe-inline' (SSR style attributes)").toEqual([
		"'unsafe-inline'"
	]);
	const elements = effectiveSources(csp, 'style-src-elem', 'style-src', 'default-src') ?? [];
	const what = `style elements ${JSON.stringify(elements)}`;
	expect(elements, `got ${what}, want 'self'`).toContain("'self'");
	expect(elements, `got ${what}, want no 'unsafe-inline'`).not.toContain("'unsafe-inline'");
	expect(elements.filter(isHostOrScheme), `got ${what}, want no host or scheme`).toEqual([]);
}

test.describe('CSP header on every HTML response', () => {
	for (const { url, status } of HTML_RESPONSES) {
		test(`${url} (${status}): enforced, with the fixed directives`, async ({
			request,
			baseURL
		}, testInfo) => {
			onlyInOneProject(testInfo);
			const { res, csp } = await fetchPolicy(baseURL!, request, url);
			expect(res.status(), `got ${res.status()}, want ${status}`).toBe(status);
			const reportOnly = res.headers()['content-security-policy-report-only'];
			expect(reportOnly, `got Report-Only ${reportOnly}, want none`).toBeUndefined();
			for (const [name, want] of FIXED_DIRECTIVES) {
				expect(sorted(csp.get(name)), `got ${name} ${csp.get(name)}, want ${want}`).toEqual(want);
			}
		});

		test(`${url} (${status}): img-src is 'self' only without MEDIA_BASE_URL`, async ({
			request,
			baseURL
		}, testInfo) => {
			onlyInOneProject(testInfo);
			expectImgSrc((await fetchPolicy(baseURL!, request, url)).csp, []);
		});

		test(`${url} (${status}): scripts by nonce/hash only, inline scripts allowed`, async ({
			request,
			baseURL
		}, testInfo) => {
			onlyInOneProject(testInfo);
			const { csp, html } = await fetchPolicy(baseURL!, request, url);
			expectStrictScriptSrc(csp);
			expectInlineScriptsAllowed(csp, html);
		});

		test(`${url} (${status}): style attributes allowed, style elements 'self' only`, async ({
			request,
			baseURL
		}, testInfo) => {
			onlyInOneProject(testInfo);
			expectNarrowStyles((await fetchPolicy(baseURL!, request, url)).csp);
		});
	}

	test('a nonce is fresh on every response', async ({ request, baseURL }, testInfo) => {
		onlyInOneProject(testInfo);
		const first = scriptSources((await fetchPolicy(baseURL!, request, '/en/')).csp);
		const second = scriptSources((await fetchPolicy(baseURL!, request, '/en/')).csp);
		const nonces = [...first, ...second].filter(isNonce);
		test.skip(nonces.length === 0, 'hashes only: nothing to rotate');
		expect(new Set(nonces).size, `got nonces ${nonces}, want a new one per response`).toBe(
			nonces.length
		);
	});
});

test.describe('CSP img-src follows MEDIA_BASE_URL at runtime', () => {
	let server: AppServer | undefined;

	test.beforeAll(async () => {
		if (test.info().project.name !== PROJECT) return;
		server = await startAppServer({ MEDIA_BASE_URL });
	});
	test.afterAll(async () => {
		await server?.stop();
	});

	for (const { url, status } of HTML_RESPONSES) {
		test(`MEDIA_BASE_URL=${MEDIA_BASE_URL}: ${url} img-src allows ${MEDIA_ORIGIN}`, async ({
			request
		}, testInfo) => {
			onlyInOneProject(testInfo);
			const { res, csp } = await fetchPolicy(server!.baseURL, request, url);
			expect(res.status(), `got ${res.status()}, want ${status}`).toBe(status);
			expectImgSrc(csp, [MEDIA_ORIGIN]);
			expectStrictScriptSrc(csp);
		});
	}
});

test.describe('D-FE8-1: the proxy headers are Caddy’s, not the app’s', () => {
	const urls = [...HTML_RESPONSES.map((r) => r.url), '/robots.txt', '/sitemap.xml', '/healthz'];
	for (const url of urls) {
		test(`${url} sends no HSTS, nosniff, Referrer- or Permissions-Policy`, async ({
			request
		}, testInfo) => {
			onlyInOneProject(testInfo);
			const headers = (await getRaw(request, url)).headers();
			const sent = PROXY_HEADERS.filter((name) => headers[name] !== undefined);
			expect(sent, `got ${JSON.stringify(sent)} from the app, want none (INF-5)`).toEqual([]);
		});
	}
});

// The tours: each page load must carry the policy, and the `page` fixture
// fails the test on any violation the flow triggers.
async function gotoWithCsp(page: Page, url: string, status = 200) {
	const res = await page.goto(url, { waitUntil: 'networkidle' });
	expect(res?.status(), `got ${res?.status()} for ${url}, want ${status}`).toBe(status);
	const header = await res?.headerValue('content-security-policy');
	expect(header, `got no Content-Security-Policy on ${url}, want one`).toBeTruthy();
}

async function recipeFlow(page: Page) {
	await gotoWithCsp(page, '/en/dishes/tortilla');
	await variationCards(page).first().click();
	await page.waitForURL((url) => /^\/en\/dishes\/tortilla\/[a-z]+$/.test(url.pathname));
	await moreButton(page, 'en').click();
	await ingredientRows(page).first().click();
	await expect(ingredientRows(page).first()).toHaveAttribute('aria-pressed', 'true');
	await stepRows(page).first().click();
	await expect(stepRows(page).first()).toHaveAttribute('aria-pressed', 'true');
	await page.goBack();
	await page.waitForURL((url) => url.pathname === '/en/dishes/tortilla');
}

async function languageSwitch(page: Page) {
	await gotoWithCsp(page, '/en/');
	await openMenu(page, 'en');
	await page.keyboard.press('Escape');
	await openMenu(page, 'en');
	await menuRow(page, 'en', 'es').click();
	await page.waitForURL((url) => url.pathname === '/es/');
}

test.describe('no CSP violations on the key flows', () => {
	test(
		'mobile: home, region sheet, Popular + dish sheet, search, language, Variations, Recipe, error',
		CROSS_BROWSER,
		async ({ page }) => {
			test.skip(isDesktopPage(page), 'the mobile tour');
			await gotoWithCsp(page, '/en/');
			await tapRegion(page, 'gal');
			await expectSheetPeek(page, 'Galicia');
			await gotoWithCsp(page, '/en/?tab=popular&f=tapas&f=mains&f=desserts');
			await dishCard(page, 'tortilla').click();
			await page.waitForURL((url) => url.searchParams.get('dish') === 'tortilla');
			await expect(dishSheet(page)).toBeVisible();
			await gotoHydrated(page, '/en/');
			await searchFor(page, 'en', 'tortilla');
			await expect(resultGroup(page, 'en', DISHES)).toBeVisible();
			await page.keyboard.press('Escape');
			await languageSwitch(page);
			await recipeFlow(page);
			await gotoWithCsp(page, '/en/dishes/no-such-dish', 404);
		}
	);

	test(
		'desktop: home, region panel, Popular filters, search dropdown, language, Variations, Recipe, error',
		CROSS_BROWSER,
		async ({ page }) => {
			test.skip(!isDesktopPage(page), 'the desktop tour');
			await gotoWithCsp(page, '/en/');
			await tapRegion(page, 'gal');
			await gotoWithCsp(page, '/en/?tab=popular');
			await sidebarChip(page, 'en', 'vegetarian').click();
			await page.waitForURL((url) => url.searchParams.getAll('f').includes('vegetarian'));
			await typeInDesktopSearch(page, 'en', 'tortilla');
			await expect(searchDropdown(page)).toBeVisible();
			await page.keyboard.press('Escape');
			await languageSwitch(page);
			await recipeFlow(page);
			await gotoWithCsp(page, '/fr/', 404);
		}
	);
});

// With MEDIA_BASE_URL set (and a backend that has photo prefixes), photos come
// from the media origin: the runtime img-src must let them load, in every
// engine, with no violation.
test.describe('no CSP violations with photos from MEDIA_BASE_URL', () => {
	const PHOTOS = {
		tortilla: {
			thumb: 'dishes/tortilla/thumb-1a2b3c4d',
			card: 'dishes/tortilla/card-5e6f7a8b',
			hero: 'dishes/tortilla/hero-9c0d1e2f'
		}
	};
	let started: AppWithBackend | undefined;

	test.beforeAll(async () => {
		started = await startAppWithBackend(catalogBackend(PHOTOS), { MEDIA_BASE_URL });
	});
	test.afterAll(async () => {
		await started?.stop();
	});

	test(
		'Variations: the dish photo loads from the media origin',
		CROSS_BROWSER,
		async ({ page }) => {
			const requested = await stubMediaHost(page, MEDIA_ORIGIN);
			await gotoWithCsp(page, `${started!.app.baseURL}/en/dishes/tortilla`);
			await expect
				.poll(() => loadedImagesFrom(page, MEDIA_BASE_URL), {
					message: `want a photo loaded from ${MEDIA_BASE_URL}; requested ${requested}`
				})
				.toBeGreaterThan(0);
		}
	);
});
