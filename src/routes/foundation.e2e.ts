import { expect, test, type Page, type Request } from '@playwright/test';

// FE-0 foundation: token-styled global layout and self-hosted fonts
// (D-FE0-1). Runs in every Playwright project.

const BG_PAGE = 'rgb(246, 239, 227)'; // --bg-page: #F6EFE3
const MAX_WIDTH = 1440;

async function gotoCollecting(page: Page, url = '/'): Promise<Request[]> {
	const requests: Request[] = [];
	page.on('request', (r) => requests.push(r));
	const res = await page.goto(url, { waitUntil: 'networkidle' });
	expect(res?.status(), `got status ${res?.status()}, want 200`).toBe(200);
	await page.evaluate(() => document.fonts.ready.then(() => undefined));
	return requests;
}

function originOf(url: string): string {
	return new URL(url).origin;
}

test.describe('global layout', () => {
	test('body uses the --bg-page background and the --font-text stack', async ({ page }) => {
		await gotoCollecting(page);
		const styles = await page.evaluate(() => {
			const cs = getComputedStyle(document.body);
			return { bg: cs.backgroundColor, font: cs.fontFamily };
		});
		expect(styles.bg, `got background ${styles.bg}, want ${BG_PAGE}`).toBe(BG_PAGE);
		expect(
			styles.font.replace(/["']/g, ''),
			`got font-family ${styles.font}, want it to start with Archivo`
		).toMatch(/^Archivo\s*,/);
	});

	test('app shell is capped at 1440px and centred on a 1920px viewport', async ({ page }) => {
		await page.setViewportSize({ width: 1920, height: 1080 });
		await gotoCollecting(page);
		const shell = page.getByTestId('app-shell');
		await expect(shell).toHaveCount(1);
		const box = await shell.boundingBox();
		expect(box, 'got no bounding box for app-shell').not.toBeNull();
		expect(box!.width, `got width ${box!.width}, want ${MAX_WIDTH}`).toBe(MAX_WIDTH);
		const wantLeft = (1920 - MAX_WIDTH) / 2;
		expect(box!.x, `got left ${box!.x}, want ${wantLeft}`).toBe(wantLeft);
	});

	test('app shell fits the project viewport without horizontal scroll', async ({ page }) => {
		await gotoCollecting(page);
		const shell = page.getByTestId('app-shell');
		await expect(shell).toHaveCount(1);
		const m = await page.evaluate(() => {
			const el = document.querySelector('[data-testid="app-shell"]')!;
			return {
				shellWidth: el.getBoundingClientRect().width,
				innerWidth: window.innerWidth,
				scrollWidth: document.documentElement.scrollWidth
			};
		});
		expect(
			m.shellWidth,
			`got shell width ${m.shellWidth}, want <= ${m.innerWidth}`
		).toBeLessThanOrEqual(m.innerWidth);
		expect(
			m.scrollWidth,
			`got scrollWidth ${m.scrollWidth}, want <= innerWidth ${m.innerWidth}`
		).toBeLessThanOrEqual(m.innerWidth);
	});
});

test.describe('self-hosted fonts', () => {
	test('no request goes to a third-party origin during load', async ({ page, baseURL }) => {
		const requests = await gotoCollecting(page);
		const own = originOf(baseURL!);
		const urls = requests.map((r) => r.url()).filter((u) => !u.startsWith('data:'));
		const google = urls.filter((u) => /fonts\.(googleapis|gstatic)\.com/.test(u));
		expect(google, `got Google Fonts requests ${JSON.stringify(google)}, want none`).toEqual([]);
		const foreign = urls.filter((u) => originOf(u) !== own);
		expect(foreign, `got third-party requests ${JSON.stringify(foreign)}, want none`).toEqual([]);
	});

	test('fonts are requested same-origin and as woff2 only', async ({ page, baseURL }) => {
		const requests = await gotoCollecting(page);
		const own = originOf(baseURL!);
		const fonts = requests.filter((r) => r.resourceType() === 'font').map((r) => r.url());
		expect(fonts.length, 'got no font requests, want at least one').toBeGreaterThan(0);
		for (const url of fonts) {
			expect(url.startsWith('data:'), `got inlined font ${url.slice(0, 60)}, want a file`).toBe(
				false
			);
			expect(originOf(url), `got font origin ${originOf(url)}, want ${own}`).toBe(own);
			expect(new URL(url).pathname, `got font ${url}, want a .woff2 file`).toMatch(/\.woff2$/);
		}
	});

	test('head preloads exactly the two primary faces, and both load', async ({ page, request }) => {
		await gotoCollecting(page);
		const preloads = await page.evaluate(() =>
			[...document.head.querySelectorAll('link[rel="preload"][as="font"]')].map((l) => ({
				href: (l as HTMLLinkElement).href,
				type: l.getAttribute('type'),
				crossorigin: l.hasAttribute('crossorigin')
			}))
		);
		expect(preloads.length, `got ${JSON.stringify(preloads)}, want exactly 2 font preloads`).toBe(
			2
		);
		for (const p of preloads) {
			expect(p.type, `got type ${p.type} on ${p.href}, want font/woff2`).toBe('font/woff2');
			expect(p.crossorigin, `got no crossorigin on ${p.href}, want it set`).toBe(true);
			expect(new URL(p.href).pathname, `got ${p.href}, want a .woff2 file`).toMatch(/\.woff2$/);
			const res = await request.get(p.href);
			expect(res.status(), `got ${res.status()} fetching ${p.href}, want 200`).toBe(200);
		}
		// The primary faces: Instrument Serif 400 latin and Archivo 400 latin
		// (fontsource file names; the build may add a hash).
		const paths = preloads.map((p) => new URL(p.href).pathname).sort();
		const want = [
			/archivo-latin-400-normal[^/]*\.woff2$/,
			/instrument-serif-latin-400-normal[^/]*\.woff2$/
		];
		for (const re of want) {
			expect(
				paths.some((p) => re.test(p)),
				`got preloads ${JSON.stringify(paths)}, want one matching ${re}`
			).toBe(true);
		}
	});

	test('Archivo and Instrument Serif are loaded and usable', async ({ page }) => {
		await gotoCollecting(page);
		const r = await page.evaluate(async () => {
			const serif = await document.fonts.load('16px "Instrument Serif"', 'Asadorov');
			const text = await document.fonts.load('16px "Archivo"', 'Asadorov');
			return {
				serifLoaded: serif.length,
				textLoaded: text.length,
				archivo: document.fonts.check('16px "Archivo"', 'Asadorov'),
				instrument: document.fonts.check('16px "Instrument Serif"', 'Asadorov')
			};
		});
		expect(r.textLoaded, `got ${r.textLoaded} Archivo faces loaded, want >= 1`).toBeGreaterThan(0);
		expect(
			r.serifLoaded,
			`got ${r.serifLoaded} Instrument Serif faces loaded, want >= 1`
		).toBeGreaterThan(0);
		expect(r.archivo, 'got fonts.check("Archivo") false, want true').toBe(true);
		expect(r.instrument, 'got fonts.check("Instrument Serif") false, want true').toBe(true);
	});

	test('Cyrillic fallbacks Golos Text and Cormorant Garamond load for Cyrillic text', async ({
		page
	}) => {
		await gotoCollecting(page);
		const r = await page.evaluate(async () => ({
			golos: (await document.fonts.load('16px "Golos Text"', 'Привет')).length,
			cormorant: (await document.fonts.load('500 16px "Cormorant Garamond"', 'Привет')).length
		}));
		expect(r.golos, `got ${r.golos} Golos Text faces for Cyrillic, want >= 1`).toBeGreaterThan(0);
		expect(
			r.cormorant,
			`got ${r.cormorant} Cormorant Garamond faces for Cyrillic, want >= 1`
		).toBeGreaterThan(0);
	});

	test('declares exactly the D-FE0-1 faces, weights and subsets', async ({ page }) => {
		await gotoCollecting(page);
		const faces = await page.evaluate(() =>
			[...document.fonts].map((f) => ({
				family: f.family.replace(/["']/g, ''),
				weight: f.weight,
				style: f.style,
				unicodeRange: f.unicodeRange
			}))
		);

		const families = [...new Set(faces.map((f) => f.family))].sort();
		expect(families, `got families ${JSON.stringify(families)}`).toEqual([
			'Archivo',
			'Cormorant Garamond',
			'Golos Text',
			'Instrument Serif'
		]);
		for (const f of faces) {
			expect(f.style, `got style ${f.style} for ${f.family} ${f.weight}, want normal`).toBe(
				'normal'
			);
		}

		const want: { family: string; weights: string[]; subsets: 'latin' | 'cyrillic' }[] = [
			{ family: 'Instrument Serif', weights: ['400'], subsets: 'latin' },
			{ family: 'Archivo', weights: ['400', '500', '600', '700'], subsets: 'latin' },
			{ family: 'Cormorant Garamond', weights: ['500'], subsets: 'cyrillic' },
			{ family: 'Golos Text', weights: ['400', '500', '600', '700'], subsets: 'cyrillic' }
		];
		for (const w of want) {
			const ofFamily = faces.filter((f) => f.family === w.family);
			const weights = [...new Set(ofFamily.map((f) => f.weight))].sort();
			expect(weights, `got ${w.family} weights ${JSON.stringify(weights)}`).toEqual(w.weights);
			for (const weight of w.weights) {
				const set = ofFamily.filter((f) => f.weight === weight).map((f) => f.unicodeRange);
				const label = `${w.family} ${weight} unicode-ranges ${JSON.stringify(set)}`;
				expectSubsets(set, w.subsets, label);
			}
		}
	});
});

// Latin faces ship latin + latin-ext only; Cyrillic fallbacks ship cyrillic only.
function expectSubsets(set: string[], subsets: 'latin' | 'cyrillic', label: string) {
	if (subsets === 'cyrillic') {
		expect(set.length, `got ${label}, want exactly the cyrillic subset`).toBe(1);
		expect(covers(set[0], CYR_A), `got ${label}, want cyrillic`).toBe(true);
		return;
	}
	expect(set.length, `got ${label}, want exactly latin + latin-ext`).toBe(2);
	expect(
		set.some((r) => covers(r, A)),
		`got ${label}, want latin`
	).toBe(true);
	expect(
		set.some((r) => covers(r, A_MACRON)),
		`got ${label}, want latin-ext`
	).toBe(true);
	expect(
		set.some((r) => covers(r, CYR_A)),
		`got ${label}, want no cyrillic`
	).toBe(false);
}

// Parse a unicode-range descriptor (any browser's serialisation).
const covers = (range: string, cp: number) =>
	range.split(',').some((part) => {
		const m = /U\+([0-9A-F?]+)(?:-([0-9A-F]+))?/i.exec(part.trim());
		if (!m) return false;
		const lo = parseInt(m[1].replace(/\?/g, '0'), 16);
		const hi = m[2] ? parseInt(m[2], 16) : parseInt(m[1].replace(/\?/g, 'F'), 16);
		return cp >= lo && cp <= hi;
	});
const A = 0x41; // latin
const A_MACRON = 0x100; // latin-ext
const CYR_A = 0x410; // cyrillic
