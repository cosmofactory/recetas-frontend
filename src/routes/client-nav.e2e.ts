import { expect, test, type Page } from '@playwright/test';
import { PAGES } from '../testutil/e2e';

// FE-1 review follow-ups: <html lang> must follow client-side navigation (it
// is set server-side per request, so a router navigation must update it too),
// and hydrating a 404 page must not trip over a missing locale.

// Adds a link inside the app root (SvelteKit's router only handles links
// there) and clicks it from script, as the empty link has no box to click;
// a window marker proves the page was not reloaded.
async function clientNavigate(page: Page, href: string) {
	await page.evaluate((to) => {
		(window as unknown as { __noReload: boolean }).__noReload = true;
		const a = document.createElement('a');
		a.href = to;
		document.querySelector('[data-testid="app-shell"]')!.append(a);
		a.click();
	}, href);
	await page.waitForURL((url) => url.pathname === href);
	const kept = await page.evaluate(
		() => (window as unknown as { __noReload?: boolean }).__noReload
	);
	expect(kept, `got a full reload navigating to ${href}, want a client-side navigation`).toBe(true);
}

// `text`: a localised text the destination shows (PAGES); the region page
// shows its name on the map (FE-4 PR 2), the others as their <h1>.
const navigations: { from: string; to: string; lang: string; text: string }[] = [
	{ from: '/en/', to: '/ru/dishes/tortilla', lang: 'ru', text: PAGES[2].text.ru },
	{ from: '/en/', to: '/es/regions/gal', lang: 'es', text: PAGES[1].text.es },
	{ from: '/ru/', to: '/en/dishes/tortilla/gal', lang: 'en', text: PAGES[3].text.en }
];

test.describe('<html lang> on client-side navigation', () => {
	for (const nav of navigations) {
		test(`${nav.from} -> ${nav.to} sets lang="${nav.lang}"`, async ({ page }) => {
			await page.goto(nav.from, { waitUntil: 'networkidle' });
			await clientNavigate(page, nav.to);
			const shown = page.getByText(nav.text, { exact: true }).filter({ visible: true });
			await expect(shown.first(), `got no visible "${nav.text}"`).toBeVisible();
			await expect.poll(() => page.evaluate(() => document.documentElement.lang)).toBe(nav.lang);
		});
	}
});

test.describe('hydrating a 404 page', () => {
	for (const url of ['/fr/x', '/xx/dishes/tortilla']) {
		test(`${url} hydrates without errors`, async ({ page }) => {
			const pageErrors: string[] = [];
			const localeErrors: string[] = [];
			page.on('pageerror', (err) => pageErrors.push(String(err)));
			page.on('console', (msg) => {
				if (msg.type() === 'error' && /locale/i.test(msg.text())) localeErrors.push(msg.text());
			});
			const res = await page.goto(url, { waitUntil: 'networkidle' });
			expect(res?.status(), `got status ${res?.status()}, want 404`).toBe(404);
			expect(pageErrors, `got page errors ${JSON.stringify(pageErrors)}`).toEqual([]);
			expect(localeErrors, `got console errors ${JSON.stringify(localeErrors)}`).toEqual([]);
		});
	}
});
