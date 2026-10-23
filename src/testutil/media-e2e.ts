import type { Page } from '@playwright/test';

// Stands in for the media CDN (MEDIA_BASE_URL) in the browser: every request
// to it gets a 1×1 PNG. Browsers decode an image by its bytes and
// Content-Type, not by the URL's extension, so one PNG serves the AVIF, WebP
// and JPEG variants alike. CSP is checked before the request is made, so a
// blocked photo never reaches the route.

const ONE_PIXEL_PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
	'base64'
);

// Returns the URLs the page fetched from the media host, in order.
export async function stubMediaHost(page: Page, mediaOrigin: string): Promise<string[]> {
	const requested: string[] = [];
	await page.route(`${mediaOrigin}/**`, (route) => {
		requested.push(route.request().url());
		return route.fulfill({ contentType: 'image/png', body: ONE_PIXEL_PNG });
	});
	return requested;
}

// How many <img> elements show a picture from `baseUrl`: decode() resolves
// only once one is loaded and decodable (naturalWidth can't tell: a 1×1 file
// under a `w` descriptor reports a density-corrected width that rounds to 0).
export function loadedImagesFrom(page: Page, baseUrl: string): Promise<number> {
	return page.evaluate(async (base) => {
		const fromBase = [...document.images].filter((img) => img.currentSrc.startsWith(base));
		const decoded = await Promise.allSettled(fromBase.map((img) => img.decode()));
		return decoded.filter(({ status }) => status === 'fulfilled').length;
	}, baseUrl);
}
