import { expect, test } from '@playwright/test';

test('home page renders', { tag: '@cross-browser' }, async ({ page }) => {
	const response = await page.goto('/');
	expect(response?.status()).toBe(200);
	// The home renders both layouts; only one <h1> shows at a time (FE-4).
	await expect(page.locator('h1').filter({ visible: true })).toHaveCount(1);
});

test('/healthz is ok', async ({ request }) => {
	const res = await request.get('/healthz');
	expect(res.status()).toBe(200);
	expect(await res.json()).toEqual({ status: 'ok' });
});
