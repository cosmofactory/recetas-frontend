import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { getRaw } from '../testutil/e2e';
import {
	expectSameDocument,
	gotoHydrated,
	HOME_COPY,
	markDocument,
	onlyVisible,
	pathAndQuery,
	tab,
	visibleMap
} from '../testutil/home-e2e';

// FE-4 PR 2 (stage FE-4 -> Delivery 2, Small decisions, Header):
// - Home (/:lang/) and /:lang/regions/:regionKey render through one
//   route-group layout, src/routes/[lang=lang]/(home)/+layout.svelte, so
//   navigating between them keeps it mounted ("the sheet animates; no
//   remount"): the map is the same DOM node before and after.
// - "Tab state lives in the URL: Regional = no `tab` param. Switching tabs
//   closes any open sheet" (both READMEs -> State): a tab press navigates
//   (a history entry), the selected tab follows the URL on load and on
//   back/forward, and switching from a region URL lands on /:lang/?tab=popular.
//   Popular is a placeholder tabpanel until FE-5, "labelled by its tab".
// - Carried over from FE-3: SSR renders the mobile header and the desktop
//   top bar together; only one carries the tab ids (`${panelId}-tab`) and
//   the language `controls`, so the HTML has no duplicate id.

const en = HOME_COPY.en;

// Data checks that don't depend on the viewport run in one project.
const HTML_PROJECT = 'chromium-mobile-390';

function onlyInHtmlProject(testInfo: TestInfo) {
	test.skip(testInfo.project.name !== HTML_PROJECT, `HTML checks run in ${HTML_PROJECT} only`);
}

// Clicks a cell of the region's map link (only cells take pointer events).
async function clickRegion(page: Page, regionKey: string) {
	const href = `/en/regions/${regionKey}`;
	await visibleMap(page).locator(`a[href="${href}"] [data-map-cell]`).first().click();
	await page.waitForURL((url) => url.pathname === href);
}

// Tags the visible map node, to compare node identity after a navigation.
async function tagMap(page: Page) {
	await visibleMap(page).evaluate((el) => {
		(window as unknown as { __homeMap: Element }).__homeMap = el;
	});
}

async function expectSameMap(page: Page, what: string) {
	await expect(visibleMap(page)).toHaveCount(1);
	const same = await visibleMap(page).evaluate(
		(el) => (window as unknown as { __homeMap?: Element }).__homeMap === el
	);
	expect(same, `got a new map element ${what}, want the (home) layout kept mounted`).toBe(true);
}

test.describe('(home) route group keeps the layout mounted', () => {
	test('home → region keeps the same map element', async ({ page }) => {
		await gotoHydrated(page, '/en/');
		await markDocument(page);
		await tagMap(page);
		await clickRegion(page, 'gal');
		await expectSameDocument(page, 'clicking a region');
		await expectSameMap(page, 'after /en/ → /en/regions/gal');
	});

	test('region → back to home keeps the same map element', async ({ page }) => {
		await gotoHydrated(page, '/en/');
		await clickRegion(page, 'gal');
		await tagMap(page);
		await page.goBack();
		await page.waitForURL((url) => url.pathname === '/en/');
		await expectSameMap(page, 'after Back to /en/');
	});

	test('region → another region keeps the same map element', async ({ page }) => {
		await gotoHydrated(page, '/en/regions/gal');
		await tagMap(page);
		await clickRegion(page, 'and');
		await expectSameMap(page, 'after /en/regions/gal → /en/regions/and');
	});

	test('a region deep link renders the home shell', async ({ page }) => {
		await gotoHydrated(page, '/en/regions/gal');
		await expect(visibleMap(page), 'got no map on /en/regions/gal').toHaveCount(1);
		await expect(tab(page, en.regional)).toHaveAttribute('aria-selected', 'true');
	});
});

test.describe('tab state in the URL', () => {
	const loads: { url: string; selected: string; other: string }[] = [
		{ url: '/en/', selected: en.regional, other: en.popular },
		{ url: '/en/?tab=popular', selected: en.popular, other: en.regional },
		{ url: '/en/?tab=bogus', selected: en.regional, other: en.popular },
		{ url: '/en/regions/gal', selected: en.regional, other: en.popular }
	];
	for (const tc of loads) {
		test(`${tc.url} selects ${tc.selected}`, async ({ page }) => {
			await gotoHydrated(page, tc.url);
			await expect(tab(page, tc.selected)).toHaveAttribute('aria-selected', 'true');
			await expect(tab(page, tc.other)).toHaveAttribute('aria-selected', 'false');
		});
	}

	test('pressing Popular navigates to ?tab=popular without a reload', async ({ page }) => {
		await gotoHydrated(page, '/en/');
		await markDocument(page);
		await tab(page, en.popular).click();
		await page.waitForURL((url) => url.search === '?tab=popular');
		expect(pathAndQuery(page)).toBe('/en/?tab=popular');
		await expectSameDocument(page, 'switching tabs');
		await expect(tab(page, en.popular)).toHaveAttribute('aria-selected', 'true');
	});

	test('pressing Regional on Popular goes to /:lang/ with no tab param', async ({ page }) => {
		await gotoHydrated(page, '/en/?tab=popular');
		await tab(page, en.regional).click();
		await page.waitForURL((url) => url.pathname === '/en/' && url.search === '');
		await expect(tab(page, en.regional)).toHaveAttribute('aria-selected', 'true');
		await expect(visibleMap(page)).toHaveCount(1);
	});

	test('Back and Forward restore the tab', async ({ page }) => {
		await gotoHydrated(page, '/en/');
		await tab(page, en.popular).click();
		await page.waitForURL((url) => url.search === '?tab=popular');
		await page.goBack();
		await page.waitForURL((url) => url.pathname === '/en/' && url.search === '');
		await expect(tab(page, en.regional)).toHaveAttribute('aria-selected', 'true');
		await expect(visibleMap(page), 'got no map back on Regional').toHaveCount(1);
		await page.goForward();
		await page.waitForURL((url) => url.search === '?tab=popular');
		await expect(tab(page, en.popular)).toHaveAttribute('aria-selected', 'true');
		await expect(visibleMap(page), 'got the map on Popular').toHaveCount(0);
	});

	test('switching to Popular from a region closes it: /:lang/?tab=popular', async ({ page }) => {
		await gotoHydrated(page, '/en/regions/gal');
		await tab(page, en.popular).click();
		await page.waitForURL((url) => url.search === '?tab=popular');
		expect(pathAndQuery(page), 'want the region closed').toBe('/en/?tab=popular');
	});

	test('Back after switching from a region returns to the region', async ({ page }) => {
		await gotoHydrated(page, '/en/regions/gal');
		await tab(page, en.popular).click();
		await page.waitForURL((url) => url.search === '?tab=popular');
		await page.goBack();
		await page.waitForURL((url) => url.pathname === '/en/regions/gal');
		await expect(tab(page, en.regional)).toHaveAttribute('aria-selected', 'true');
	});

	// SegmentedSwitch selects on arrow keys (automatic activation); the
	// navigation must not take focus away from the tab the user moved to.
	test('ArrowRight on Regional navigates to Popular and keeps focus on it', async ({ page }) => {
		await gotoHydrated(page, '/en/');
		await tab(page, en.regional).focus();
		await page.keyboard.press('ArrowRight');
		await page.waitForURL((url) => url.search === '?tab=popular');
		await expect(tab(page, en.popular)).toHaveAttribute('aria-selected', 'true');
		await expect(tab(page, en.popular), 'got focus moved off the Popular tab').toBeFocused();
	});

	// Stage FE-4 -> Small decisions, "Tabs are links": "A click adds a
	// history entry; arrow-key activation replaces it." So Back after arrow
	// keys skips every tab the keys passed through.
	test('arrow-key activation replaces the history entry', async ({ page }) => {
		await gotoHydrated(page, '/en/regions/gal');
		await gotoHydrated(page, '/en/');
		await tab(page, en.regional).focus();
		await page.keyboard.press('ArrowRight');
		await page.waitForURL((url) => url.search === '?tab=popular');
		await page.goBack();
		await page.waitForURL((url) => url.pathname !== '/en/' || url.search !== '?tab=popular');
		expect(pathAndQuery(page), 'want Back to skip the arrow-key tab change').toBe(
			'/en/regions/gal'
		);
	});

	test('arrow keys back and forth leave one entry: Back leaves the home', async ({ page }) => {
		await gotoHydrated(page, '/en/regions/gal');
		await gotoHydrated(page, '/en/');
		await tab(page, en.regional).focus();
		await page.keyboard.press('ArrowRight');
		await page.waitForURL((url) => url.search === '?tab=popular');
		await page.keyboard.press('ArrowLeft');
		await page.waitForURL((url) => url.pathname === '/en/' && url.search === '');
		await page.goBack();
		await expect
			.poll(() => pathAndQuery(page), { message: 'want Back to leave the home' })
			.toBe('/en/regions/gal');
	});

	test('a click adds one history entry: Back returns to the previous tab', async ({ page }) => {
		await gotoHydrated(page, '/en/regions/gal');
		await gotoHydrated(page, '/en/');
		await tab(page, en.popular).click();
		await page.waitForURL((url) => url.search === '?tab=popular');
		await page.goBack();
		await page.waitForURL((url) => url.search === '');
		expect(pathAndQuery(page), 'want Back to undo only the click').toBe('/en/');
	});

	// Stage FE-4 -> Small decisions: "A region URL always shows Regional
	// (`?tab` is ignored there)".
	test('/en/regions/gal?tab=popular shows Regional with Galicia selected', async ({ page }) => {
		await gotoHydrated(page, '/en/regions/gal?tab=popular');
		await expect(tab(page, en.regional)).toHaveAttribute('aria-selected', 'true');
		await expect(visibleMap(page)).toHaveCount(1);
		const galicia = visibleMap(page).locator('a[href="/en/regions/gal"]');
		await expect(galicia).toHaveAttribute('aria-current', 'true');
	});

	test('the tablist is named in the current language', async ({ page }) => {
		await gotoHydrated(page, '/ru/');
		const ru = HOME_COPY.ru;
		await expect(page.getByRole('tablist', { name: ru.tabsLabel, exact: true })).toHaveCount(1);
	});
});

test.describe('tab panels', () => {
	test('Regional: one visible tabpanel, named by its tab, holding the map', async ({ page }) => {
		await gotoHydrated(page, '/en/');
		const panels = onlyVisible(page.getByRole('tabpanel'));
		await expect(panels, 'want exactly one visible tabpanel').toHaveCount(1);
		const panel = page.getByRole('tabpanel', { name: en.regional, exact: true });
		await expect(panel).toBeVisible();
		await expect(panel.getByTestId('region-map').filter({ visible: true })).toHaveCount(1);
	});

	test('Popular: one visible tabpanel, named by its tab, and no map', async ({ page }) => {
		await gotoHydrated(page, '/en/?tab=popular');
		await expect(onlyVisible(page.getByRole('tabpanel'))).toHaveCount(1);
		await expect(page.getByRole('tabpanel', { name: en.popular, exact: true })).toBeVisible();
		await expect(visibleMap(page), 'got a map on Popular, want none').toHaveCount(0);
	});

	test('the visible panel is the one the selected tab controls', async ({ page }) => {
		await gotoHydrated(page, '/en/');
		const panelId = await onlyVisible(page.getByRole('tabpanel')).getAttribute('id');
		expect(panelId, 'got a tabpanel without an id').toBeTruthy();
		const controller = page.locator(`[role="tab"][aria-controls="${panelId}"]`);
		await expect(controller, `want one tab controlling #${panelId}`).toHaveCount(1);
		await expect(controller).toHaveAttribute('aria-selected', 'true');
		await expect(controller).toHaveText(en.regional);
	});
});

type Tag = { name: string; attrs: Record<string, string> };

// Every start tag in the HTML with its attributes (Svelte writes them quoted).
function startTags(html: string): Tag[] {
	const tags = html.replace(/<!--[\s\S]*?-->/g, '').match(/<[a-zA-Z][^>]*>/g) ?? [];
	return tags.map((tag) => ({
		name: /^<([a-zA-Z0-9-]+)/.exec(tag)![1].toLowerCase(),
		attrs: Object.fromEntries(
			[...tag.matchAll(/\s([a-zA-Z:-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]])
		)
	}));
}

function duplicates(values: string[]): string[] {
	return [...new Set(values.filter((v, i) => values.indexOf(v) !== i))];
}

// aria-controls / aria-labelledby values that point at no id in the page.
function danglingReferences(tags: Tag[]): string[] {
	const ids = new Set(tags.map((t) => t.attrs.id).filter(Boolean));
	const refs = tags.flatMap((t) =>
		['aria-controls', 'aria-labelledby'].flatMap((attr) =>
			(t.attrs[attr] ?? '')
				.split(/\s+/)
				.filter(Boolean)
				.map((ref) => `${attr}="${ref}"`)
		)
	);
	return refs.filter((ref) => !ids.has(/"(.*)"/.exec(ref)![1]));
}

test.describe('server HTML ids (mobile header and desktop top bar together)', () => {
	const urls = ['/en/', '/en/?tab=popular', '/en/regions/gal', '/ru/', '/es/regions/and'];
	for (const url of urls) {
		test(`${url} has no duplicate id`, async ({ request }, testInfo) => {
			onlyInHtmlProject(testInfo);
			const res = await getRaw(request, url);
			expect(res.status(), `got status ${res.status()}, want 200`).toBe(200);
			const ids = startTags(await res.text())
				.map((t) => t.attrs.id)
				.filter(Boolean);
			expect(duplicates(ids), `got duplicate ids among ${JSON.stringify(ids)}`).toEqual([]);
		});

		test(`${url} has no aria-controls/labelledby to a missing id`, async ({
			request
		}, testInfo) => {
			onlyInHtmlProject(testInfo);
			const tags = startTags(await (await getRaw(request, url)).text());
			const dangling = danglingReferences(tags);
			expect(dangling, `got references to no element: ${JSON.stringify(dangling)}`).toEqual([]);
		});

		test(`${url}: only one of the two switches carries tab ids`, async ({ request }, testInfo) => {
			onlyInHtmlProject(testInfo);
			const tabs = startTags(await (await getRaw(request, url)).text()).filter(
				(t) => t.attrs.role === 'tab'
			);
			expect(tabs.length, 'want both switches (mobile header and top bar) in the HTML').toBe(4);
			const withId = tabs.filter((t) => t.attrs.id);
			expect(withId.length, `got ${withId.length} tabs with an id, want one switch (2)`).toBe(2);
			const controlling = tabs.filter((t) => t.attrs['aria-controls']);
			expect(controlling.length, 'want only the switch with ids to control panels').toBe(2);
		});
	}
});

test.describe('server-rendered tab state (no JavaScript)', () => {
	test.use({ javaScriptEnabled: false });

	test('/en/?tab=popular renders Popular selected and no map', async ({ page }) => {
		await page.goto('/en/?tab=popular');
		await expect(tab(page, en.popular)).toHaveAttribute('aria-selected', 'true');
		await expect(visibleMap(page)).toHaveCount(0);
	});

	// "Tabs are links": switching works without JS.
	test('clicking Popular loads /en/?tab=popular with Popular selected', async ({ page }) => {
		await page.goto('/en/');
		await tab(page, en.popular).click();
		await expect
			.poll(() => pathAndQuery(page), { message: 'want the link to load Popular' })
			.toBe('/en/?tab=popular');
		await expect(tab(page, en.popular)).toHaveAttribute('aria-selected', 'true');
	});

	test('clicking Regional on Popular loads /en/', async ({ page }) => {
		await page.goto('/en/?tab=popular');
		await tab(page, en.regional).click();
		await expect
			.poll(() => pathAndQuery(page), { message: 'want the link to load Regional' })
			.toBe('/en/');
		await expect(visibleMap(page)).toHaveCount(1);
	});

	test('/ru/regions/gal renders the home shell in Russian', async ({ page }) => {
		await page.goto('/ru/regions/gal');
		await expect(tab(page, HOME_COPY.ru.regional)).toHaveAttribute('aria-selected', 'true');
		await expect(visibleMap(page)).toHaveCount(1);
	});
});

// "Tabs are links" in the server HTML: crawlers find the Popular URL.
test.describe('server HTML tab links', () => {
	const cases = [
		{ url: '/en/', regional: '/en/', popular: '/en/?tab=popular' },
		{ url: '/ru/regions/gal', regional: '/ru/', popular: '/ru/?tab=popular' }
	];
	for (const tc of cases) {
		test(`${tc.url}: every tab is <a role="tab"> to its tab URL`, async ({ request }, testInfo) => {
			onlyInHtmlProject(testInfo);
			const tags = startTags(await (await getRaw(request, tc.url)).text());
			const tabs = tags.filter((t) => t.attrs.role === 'tab');
			expect(tabs.length, 'want both switches').toBe(4);
			for (const t of tabs) expect(t.name, `got <${t.name} role="tab">, want <a>`).toBe('a');
			const hrefs = tabs.map((t) => t.attrs.href).sort();
			const want = [tc.popular, tc.popular, tc.regional, tc.regional].sort();
			expect(hrefs, `got tab hrefs ${JSON.stringify(hrefs)}`).toEqual(want);
		});
	}
});
