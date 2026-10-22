import { expect, test, type Page } from '@playwright/test';
import { LOCALES } from '../testutil/e2e';
import {
	bottom,
	clampPx,
	expectPx,
	gotoHydrated,
	HOME_COPY,
	isDesktopPage,
	onlyVisible,
	PX_TOLERANCE,
	right,
	tokenValue,
	visibleMap,
	type Box
} from '../testutil/home-e2e';

// FE-4 PR 2, the Regional tab body: meta row, map placement, the home frame
// (mobile) and the desktop grid with "How Spain really cooks".
//
// Mobile (mobile README -> Screen 1 -> Regional tab — body; prototype 2a,
// Asadorov Explorations.dc.html l.264, l.279–284):
// - body "flex:1, padding 14px 16px 16px, column, gap 10px";
// - meta row "padding 0 4px, space-between, baseline": the eyebrow
//   "11px/600, .1em, ink-3 at .55" (prototype: uppercase,
//   rgba(43,30,22,.55)), the hint "Tap a region to preview, 11.5px ink-3";
// - the map wrapper adds "padding-top:6px"; the map is "width 100%", so it
//   sits 16px in from each side. That padding also keeps long ru labels
//   ("Балеары") on screen (FE-4 PR 1 QA: 2.1px overhang at 360 with none).
// - CLAUDE.md screen frame contract: the home screen is a viewport-sized,
//   positioned frame with overflow hidden (PR 3's BottomSheet lives in it),
//   so the mobile home never scrolls the document.
//
// Desktop (desktop README -> Layout & screens -> Regional; prototype
// Asadorov Desktop.dc.html l.84–107; stage FE-4 -> Small decisions,
// "Resolved for PR 2 (prototype wins)"):
// - grid `minmax(0,1.4fr) minmax(320px,1fr)` on a .page-container
//   (CLAUDE.md: a screen puts it on its own grid element), padding
//   "28px clamp(24px,2.8vw,40px) 36px", gap --desktop-gap
//   (clamp(28px,3.4vw,48px)), directly under the top bar;
// - left column "flex-direction:column; gap:14px": meta row (padding 0 4px;
//   eyebrow 11.5px/700, .11em, uppercase, rgba(43,30,22,.55); hint
//   desktop.clickRegion 13px rgba(43,30,22,.5) = --ink-3), then the map,
//   centred: `width: 100%; max-width: max(560px, calc((100vh - 360px) *
//   14 / 11))` (560px is the lowest the cap goes; the map is narrower when
//   its column is, e.g. ~456px at 860px);
// - then "margin-top:22px; padding:28px 4px 0; border-top:1px solid
//   rgba(43,30,22,.12); grid-template-columns: minmax(0,0.85fr)
//   minmax(0,1.15fr); gap: clamp(20px,3vw,40px)": the title (serif,
//   clamp(28px,2.6vw,38px), line-height 1.05) and the paragraph (15.5px,
//   rgba(43,30,22,.64), line-height 1.6, padding-top 4px);
// - "The page scrolls when the viewport is short".
// - Right column: the region panel arrives in PR 3; this PR only pins the
//   column track (whatever the column holds now).

// The eyebrow's AA override (stack.md X10 "Contrast overrides": the design's
// .55 → .63), resolved from the token rather than copied.
const eyebrowColour = (page: Page) => tokenValue(page, 'color', 'var(--ink-eyebrow)');
const ABOUT_RULE_COLOUR = 'rgba(43, 30, 22, 0.12)';
const ABOUT_BODY_COLOUR = 'rgba(43, 30, 22, 0.64)';
const MAP_RATIO = 11 / 14;

const MOBILE = { bodyTop: 14, bodySide: 16, metaInset: 4, metaToMap: 10 + 6 };
const DESKTOP = {
	padTop: 28,
	padBottom: 36,
	columnGap: 14,
	metaInset: 4,
	aboutMargin: 22,
	aboutPadTop: 28,
	aboutInset: 4,
	contentMax: 1440,
	panelMin: 320,
	mapCapMin: 560,
	mapCapOffset: 360
};

type Measured = { box: Box; style: Record<string, string> } | null;

type Regional = {
	clientWidth: number;
	innerHeight: number;
	header: Measured;
	tablist: Measured;
	grid: Measured;
	column: Measured;
	meta: Measured;
	eyebrow: Measured;
	hint: Measured;
	map: Measured;
	about: Measured;
	title: Measured;
	body: Measured;
};

// Everything the layout checks need, measured in the page in one go. Texts
// are found as the deepest visible element whose text is exactly that
// string; the meta row and the about block are the nearest common ancestor
// of their two texts; the grid is the map's .page-container grid ancestor.
function measureRegional(
	page: Page,
	texts: { eyebrow: string; hint: string; title: string; body: string }
) {
	return page.evaluate((t): Regional => {
		const PROPS = [
			'display',
			'font-size',
			'font-weight',
			'font-family',
			'letter-spacing',
			'line-height',
			'text-transform',
			'color',
			'align-items',
			'justify-content',
			'grid-template-columns',
			'column-gap',
			'padding-top',
			'padding-bottom',
			'padding-left',
			'padding-right',
			'border-top-width',
			'border-top-style',
			'border-top-color'
		];
		const measure = (el: Element | null) => {
			if (!el) return null;
			const r = el.getBoundingClientRect();
			const cs = getComputedStyle(el);
			const style = Object.fromEntries(PROPS.map((p) => [p, cs.getPropertyValue(p)]));
			return { box: { x: r.x, y: r.y, width: r.width, height: r.height }, style };
		};
		const visible = (el: Element) => el.checkVisibility();
		const byText = (text: string) => {
			const all = [...document.querySelectorAll('body *')].filter(
				(el) => el.textContent?.trim() === text && visible(el)
			);
			return (
				all.find((el) => ![...el.children].some((c) => c.textContent?.trim() === text)) ?? null
			);
		};
		const common = (a: Element | null, b: Element | null) => {
			let node = a?.parentElement ?? null;
			while (node && b && !node.contains(b)) node = node.parentElement;
			return b ? node : null;
		};
		const map = [...document.querySelectorAll('[data-testid="region-map"]')].find(visible) ?? null;
		const grid = map?.closest('.page-container') ?? null;
		let column: Element | null = map;
		while (column && column.parentElement !== grid) column = column.parentElement;
		const tablist = [...document.querySelectorAll('[role="tablist"]')].find(visible) ?? null;
		const eyebrow = byText(t.eyebrow);
		const hint = byText(t.hint);
		const title = byText(t.title);
		const body = byText(t.body);
		return {
			clientWidth: document.documentElement.clientWidth,
			innerHeight: window.innerHeight,
			header: measure(tablist?.closest('header') ?? null),
			tablist: measure(tablist),
			grid: measure(grid),
			column: measure(column),
			meta: measure(common(eyebrow, hint)),
			eyebrow: measure(eyebrow),
			hint: measure(hint),
			map: measure(map),
			about: measure(common(title, body)),
			title: measure(title),
			body: measure(body)
		};
	}, texts);
}

function present(measured: Measured, what: string): NonNullable<Measured> {
	expect(measured, `got no ${what} on the page`).not.toBeNull();
	return measured!;
}

function skipUnlessMobile(page: Page) {
	test.skip(isDesktopPage(page), 'mobile Regional layout: below 860px only');
}

function skipUnlessDesktopProject(page: Page) {
	test.skip(!isDesktopPage(page), 'desktop Regional layout: desktop projects only');
}

async function measureMobile(page: Page, locale: (typeof LOCALES)[number] = 'en') {
	const copy = HOME_COPY[locale];
	await gotoHydrated(page, `/${locale}/`);
	return measureRegional(page, {
		eyebrow: copy.regionsCount,
		hint: copy.tapRegion,
		title: copy.aboutTitle,
		body: copy.aboutBody
	});
}

test.describe('meta row: eyebrow and hint per layout', () => {
	for (const locale of LOCALES) {
		const copy = HOME_COPY[locale];
		test(
			`/${locale}/ shows "${copy.regionsCount}" and this layout's hint`,
			{ tag: '@layout' },
			async ({ page }) => {
				await gotoHydrated(page, `/${locale}/`);
				const shown = isDesktopPage(page) ? copy.clickRegion : copy.tapRegion;
				const hidden = isDesktopPage(page) ? copy.tapRegion : copy.clickRegion;
				await expect(onlyVisible(page.getByText(copy.regionsCount, { exact: true }))).toHaveCount(
					1
				);
				await expect(onlyVisible(page.getByText(shown, { exact: true }))).toHaveCount(1);
				await expect(onlyVisible(page.getByText(hidden, { exact: true }))).toHaveCount(0);
			}
		);
	}

	test('the eyebrow reads upper-case on screen', async ({ page }) => {
		await gotoHydrated(page, '/en/');
		const eyebrow = onlyVisible(page.getByText(HOME_COPY.en.regionsCount, { exact: true }));
		await expect(eyebrow).toHaveCSS('text-transform', 'uppercase');
	});
});

test.describe('mobile Regional layout (< 860px)', () => {
	test(
		'meta row: 14px under the switch, 16px side padding, 4px inner inset',
		{ tag: '@layout' },
		async ({ page }) => {
			skipUnlessMobile(page);
			const m = await measureMobile(page);
			const switchBox = present(m.tablist, 'switch').box;
			const meta = present(m.meta, 'meta row');
			expectPx(meta.box.y - bottom(switchBox), MOBILE.bodyTop, 'switch → meta row');
			expectPx(meta.box.x, MOBILE.bodySide, 'meta row left');
			expectPx(right(meta.box), m.clientWidth - MOBILE.bodySide, 'meta row right');
			expectPx(present(m.eyebrow, 'eyebrow').box.x, MOBILE.bodySide + MOBILE.metaInset, 'eyebrow');
			const hintRight = right(present(m.hint, 'hint').box);
			expectPx(hintRight, m.clientWidth - MOBILE.bodySide - MOBILE.metaInset, 'hint right');
			expect(meta.style['justify-content']).toBe('space-between');
			expect(meta.style['align-items']).toBe('baseline');
		}
	);

	test('eyebrow: 11px/600, .1em, upper-case, --ink-eyebrow', async ({ page }) => {
		skipUnlessMobile(page);
		const style = present((await measureMobile(page)).eyebrow, 'eyebrow').style;
		expect(style['font-size']).toBe('11px');
		expect(style['font-weight']).toBe('600');
		expectPx(parseFloat(style['letter-spacing']), 1.1, 'eyebrow tracking', 0.01);
		expect(style['text-transform']).toBe('uppercase');
		expect(style.color).toBe(await eyebrowColour(page));
	});

	test('hint: 11.5px in --ink-3', async ({ page }) => {
		skipUnlessMobile(page);
		const style = present((await measureMobile(page)).hint, 'hint').style;
		expect(style['font-size']).toBe('11.5px');
		expect(style.color).toBe(await tokenValue(page, 'color', 'var(--ink-3)'));
	});

	test(
		'map: 16px in from each side, 16px under the meta row, 14:11',
		{ tag: '@layout' },
		async ({ page }) => {
			skipUnlessMobile(page);
			const m = await measureMobile(page);
			const map = present(m.map, 'map').box;
			expectPx(map.x, MOBILE.bodySide, 'map left');
			expectPx(map.width, m.clientWidth - 2 * MOBILE.bodySide, 'map width');
			expectPx(map.y - bottom(present(m.meta, 'meta row').box), MOBILE.metaToMap, 'meta → map');
			expectPx(map.height, map.width * MAP_RATIO, 'map height', 1);
		}
	);

	// Stage FE-4 -> Small decisions: "On mobile the map is clamped to the
	// frame height (prototype `max-height: 100%`), so it fits a landscape
	// phone". At 844×390 (still the mobile layout) the whole map is on
	// screen, keeps 14:11 and is centred (prototype: "justify-content:center").
	test('landscape 844×390: the whole map fits, 14:11, centred', async ({ page }) => {
		skipUnlessMobile(page);
		await page.setViewportSize({ width: 844, height: 390 });
		const m = await measureMobile(page);
		const map = present(m.map, 'map').box;
		expect(
			bottom(map),
			`got map bottom ${bottom(map)}, want <= ${m.innerHeight}`
		).toBeLessThanOrEqual(m.innerHeight + PX_TOLERANCE);
		expect(map.y, 'got the map above the screen').toBeGreaterThanOrEqual(0);
		expectPx(map.height, map.width * MAP_RATIO, 'map height', 1);
		expectPx(map.x + map.width / 2, m.clientWidth / 2, 'map centre');
		expect(map.width, 'got a map wider than the body').toBeLessThanOrEqual(
			m.clientWidth - 2 * MOBILE.bodySide + PX_TOLERANCE
		);
	});

	test('the desktop "How Spain really cooks" block is hidden', async ({ page }) => {
		skipUnlessMobile(page);
		await gotoHydrated(page, '/en/');
		const title = onlyVisible(page.getByText(HOME_COPY.en.aboutTitle, { exact: true }));
		await expect(title).toHaveCount(0);
	});

	test(
		'every Russian map label lies within the viewport',
		{ tag: ['@layout', '@cross-browser'] },
		async ({ page }) => {
			skipUnlessMobile(page);
			await gotoHydrated(page, '/ru/');
			const labels = visibleMap(page).locator('[data-map-label]');
			await expect(labels, 'want the 14 region labels on the visible map').toHaveCount(14);
			const overhang = await page.evaluate(() => {
				const width = document.documentElement.clientWidth;
				const labels = [...document.querySelectorAll('[data-map-label]')].filter((l) =>
					l.checkVisibility()
				);
				return labels
					.map((l) => ({ text: l.textContent, r: l.getBoundingClientRect() }))
					.filter(({ r }) => r.left < 0 || r.right > width)
					.map(
						({ text, r }) => `${text} [${r.left.toFixed(1)}, ${r.right.toFixed(1)}] of ${width}`
					);
			});
			expect(overhang, `got labels past the screen edge: ${JSON.stringify(overhang)}`).toEqual([]);
		}
	);

	test(
		'the home frame is the viewport, positioned, overflow hidden',
		{ tag: '@layout' },
		async ({ page }) => {
			skipUnlessMobile(page);
			await gotoHydrated(page, '/en/');
			const frame = await page.evaluate(() => {
				const map = [...document.querySelectorAll('[data-testid="region-map"]')].find((el) =>
					el.checkVisibility()
				);
				const clips = (v: string) => v === 'hidden' || v === 'clip';
				for (let el = map?.parentElement; el && el !== document.body; el = el.parentElement) {
					const cs = getComputedStyle(el);
					if (!clips(cs.overflowX) || !clips(cs.overflowY) || cs.position === 'static') continue;
					const r = el.getBoundingClientRect();
					return { x: r.x, y: r.y, width: r.width, height: r.height };
				}
				return null;
			});
			expect(frame, 'got no positioned overflow-hidden ancestor of the map').not.toBeNull();
			const size = await page.evaluate(() => ({
				width: document.documentElement.clientWidth,
				height: window.innerHeight
			}));
			expectPx(frame!.x, 0, 'frame left');
			expectPx(frame!.y, 0, 'frame top');
			expectPx(frame!.width, size.width, 'frame width');
			expectPx(frame!.height, size.height, 'frame height', 1);
		}
	);

	test('the mobile home does not scroll the document', { tag: '@layout' }, async ({ page }) => {
		skipUnlessMobile(page);
		await gotoHydrated(page, '/ru/');
		await expect(visibleMap(page), 'want the map on the Regional tab').toHaveCount(1);
		const m = await page.evaluate(() => ({
			scroll: document.documentElement.scrollHeight,
			inner: window.innerHeight
		}));
		expect(m.scroll, `got scrollHeight ${m.scroll}, want <= ${m.inner}`).toBeLessThanOrEqual(
			m.inner
		);
	});
});

type Viewport = { width: number; height: number };

// The desktop grid's tracks for a viewport (CSS fr resolution with the
// 320px floor on the panel column).
function desktopTracks(viewport: Viewport, clientWidth: number) {
	const side = clampPx(24, 0.028 * viewport.width, 40);
	const gap = clampPx(28, 0.034 * viewport.width, 48);
	const free = Math.min(clientWidth, DESKTOP.contentMax) - 2 * side - gap;
	const panel = Math.max(DESKTOP.panelMin, free / 2.4);
	return { side, gap, mapColumn: free - panel, panel };
}

function desktopMapWidth(viewport: Viewport, mapColumn: number): number {
	const cap = Math.max(DESKTOP.mapCapMin, ((viewport.height - DESKTOP.mapCapOffset) * 14) / 11);
	return Math.min(mapColumn, cap);
}

// Stage FE-4 "Resolved for PR 2": the pinned widths.
const VIEWPORTS: { viewport: Viewport; note: string }[] = [
	{ viewport: { width: 1280, height: 800 }, note: 'cap 560' },
	{ viewport: { width: 1440, height: 900 }, note: 'cap 687.3' },
	{ viewport: { width: 1280, height: 600 }, note: 'cap stays 560 on a short viewport' },
	{ viewport: { width: 1280, height: 1100 }, note: 'limited by the column' },
	{ viewport: { width: 860, height: 800 }, note: 'fills its ~456px column' },
	{ viewport: { width: 1920, height: 1080 }, note: 'inside the 1440px content cap' }
];

async function measureDesktop(page: Page, viewport: Viewport) {
	await page.setViewportSize(viewport);
	const copy = HOME_COPY.en;
	await gotoHydrated(page, '/en/');
	return measureRegional(page, {
		eyebrow: copy.regionsCount,
		hint: copy.clickRegion,
		title: copy.aboutTitle,
		body: copy.aboutBody
	});
}

const tracksOf = (style: Record<string, string>) =>
	style['grid-template-columns'].split(/\s+/).map(parseFloat);

test.describe('desktop Regional grid (≥ 860px)', () => {
	for (const { viewport, note } of VIEWPORTS) {
		const size = `${viewport.width}×${viewport.height}`;

		test(`${size}: grid tracks, gap and padding on a .page-container`, async ({ page }) => {
			skipUnlessDesktopProject(page);
			const m = await measureDesktop(page, viewport);
			const grid = present(m.grid, '.page-container grid around the map');
			const want = desktopTracks(viewport, m.clientWidth);
			expect(grid.style.display).toBe('grid');
			const [mapColumn, panel] = tracksOf(grid.style);
			expectPx(mapColumn, want.mapColumn, 'map column track');
			expectPx(panel, want.panel, 'panel column track');
			expectPx(parseFloat(grid.style['column-gap']), want.gap, 'grid gap');
			expect(grid.style['padding-top']).toBe(`${DESKTOP.padTop}px`);
			expect(grid.style['padding-bottom']).toBe(`${DESKTOP.padBottom}px`);
			expectPx(parseFloat(grid.style['padding-left']), want.side, 'side padding');
			expectPx(grid.box.y, bottom(present(m.header, 'top bar').box), 'grid top vs top bar');
		});

		test(`${size}: map width ${note}, centred, 14:11`, async ({ page }) => {
			skipUnlessDesktopProject(page);
			const m = await measureDesktop(page, viewport);
			const column = present(m.column, 'map column').box;
			const map = present(m.map, 'map').box;
			const want = desktopMapWidth(viewport, column.width);
			expectPx(map.width, want, 'map width');
			expectPx(map.height, want * MAP_RATIO, 'map height', 1);
			expectPx(map.x - column.x, right(column) - right(map), 'map centring (left vs right space)');
		});

		test(`${size}: meta row above the map, 14px gap, 4px inset`, async ({ page }) => {
			skipUnlessDesktopProject(page);
			const m = await measureDesktop(page, viewport);
			const column = present(m.column, 'map column').box;
			const meta = present(m.meta, 'meta row').box;
			expectPx(meta.x, column.x, 'meta row left');
			expectPx(right(meta), right(column), 'meta row right');
			expectPx(present(m.eyebrow, 'eyebrow').box.x, column.x + DESKTOP.metaInset, 'eyebrow left');
			const hint = present(m.hint, 'hint').box;
			expectPx(right(hint), right(column) - DESKTOP.metaInset, 'hint right');
			expectPx(present(m.map, 'map').box.y - bottom(meta), DESKTOP.columnGap, 'meta → map');
		});

		test(`${size}: "How Spain really cooks" block under the map`, async ({ page }) => {
			skipUnlessDesktopProject(page);
			const m = await measureDesktop(page, viewport);
			const column = present(m.column, 'map column').box;
			const about = present(m.about, 'about block');
			const map = present(m.map, 'map').box;
			expectPx(about.box.y - bottom(map), DESKTOP.columnGap + DESKTOP.aboutMargin, 'map → rule');
			expectPx(about.box.x, column.x, 'about left');
			expectPx(right(about.box), right(column), 'about right');
			expect(about.style['border-top-style']).toBe('solid');
			expect(about.style['border-top-width']).toBe('1px');
			expect(about.style['border-top-color']).toBe(ABOUT_RULE_COLOUR);
			expect(about.style['padding-top']).toBe(`${DESKTOP.aboutPadTop}px`);
			expect(about.style['padding-left']).toBe(`${DESKTOP.aboutInset}px`);
			expect(about.style['padding-right']).toBe(`${DESKTOP.aboutInset}px`);
		});

		test(`${size}: about columns .85fr / 1.15fr, gap clamp(20px, 3vw, 40px)`, async ({ page }) => {
			skipUnlessDesktopProject(page);
			const m = await measureDesktop(page, viewport);
			const about = present(m.about, 'about block').box;
			const title = present(m.title, 'about title').box;
			const body = present(m.body, 'about paragraph').box;
			const gap = clampPx(20, 0.03 * viewport.width, 40);
			const inner = about.width - 2 * DESKTOP.aboutInset - gap;
			expectPx(title.x, about.x + DESKTOP.aboutInset, 'title left');
			expectPx(title.width, (inner * 0.85) / 2, 'title column');
			expectPx(body.x - right(title), gap, 'title → paragraph gap');
			expectPx(body.width, (inner * 1.15) / 2, 'paragraph column');
			expectPx(title.y, about.y + 1 + DESKTOP.aboutPadTop, 'title top (rule + padding)');
			expectPx(body.y, title.y, 'paragraph top (columns align at the start)');
		});

		test(`${size}: about title serif clamp(28px, 2.6vw, 38px), lh 1.05`, async ({ page }) => {
			skipUnlessDesktopProject(page);
			const style = present((await measureDesktop(page, viewport)).title, 'about title').style;
			const size = clampPx(28, 0.026 * viewport.width, 38);
			expectPx(parseFloat(style['font-size']), size, 'title font-size', 0.05);
			expectPx(parseFloat(style['line-height']), size * 1.05, 'title line-height', 0.1);
			expect(style['font-family'].replace(/["']/g, '')).toMatch(/^Instrument Serif\s*,/);
		});
	}

	test('about paragraph: 15.5px, line-height 1.6, ink at .64, padding-top 4px', async ({
		page
	}) => {
		skipUnlessDesktopProject(page);
		const style = present(
			(await measureDesktop(page, VIEWPORTS[0].viewport)).body,
			'paragraph'
		).style;
		expect(style['font-size']).toBe('15.5px');
		expectPx(parseFloat(style['line-height']), 15.5 * 1.6, 'paragraph line-height', 0.1);
		expect(style.color).toBe(ABOUT_BODY_COLOUR);
		expect(style['padding-top']).toBe('4px');
	});

	test('eyebrow 11.5px/700, .11em, upper-case, --ink-eyebrow; hint 13px --ink-3', async ({
		page
	}) => {
		skipUnlessDesktopProject(page);
		const m = await measureDesktop(page, VIEWPORTS[0].viewport);
		const eyebrow = present(m.eyebrow, 'eyebrow').style;
		expect(eyebrow['font-size']).toBe('11.5px');
		expect(eyebrow['font-weight']).toBe('700');
		expectPx(parseFloat(eyebrow['letter-spacing']), 0.11 * 11.5, 'eyebrow tracking', 0.01);
		expect(eyebrow['text-transform']).toBe('uppercase');
		expect(eyebrow.color).toBe(await eyebrowColour(page));
		const hint = present(m.hint, 'hint').style;
		expect(hint['font-size']).toBe('13px');
		expect(hint.color).toBe(await tokenValue(page, 'color', 'var(--ink-3)'));
	});

	for (const locale of LOCALES) {
		test(`/${locale}/: the about title is the page's one visible h1`, async ({ page }) => {
			skipUnlessDesktopProject(page);
			await gotoHydrated(page, `/${locale}/`);
			const h1 = onlyVisible(page.locator('h1'));
			await expect(h1).toHaveCount(1);
			await expect(h1).toHaveText(HOME_COPY[locale].aboutTitle);
		});
	}
});

// Whether every scrolling/clipping ancestor of the element contains it, and
// the element is inside the viewport, once scrolled into view.
function unclippedOnceScrolled(page: Page, text: string): Promise<string[]> {
	return page.evaluate((wanted) => {
		const el = [...document.querySelectorAll('body *')].find(
			(e) =>
				e.checkVisibility() &&
				(e.matches('[data-testid="region-map"]')
					? wanted === 'map'
					: e.textContent?.trim() === wanted)
		);
		if (!el) return [`no visible element for ${wanted}`];
		el.scrollIntoView({ block: 'end' });
		const r = el.getBoundingClientRect();
		const faults: string[] = [];
		if (r.top < 0 || r.bottom > window.innerHeight + 0.5)
			faults.push(`outside the viewport: ${r.top}..${r.bottom}`);
		for (let a = el.parentElement; a; a = a.parentElement) {
			if (getComputedStyle(a).overflowY === 'visible') continue;
			const ar = a.getBoundingClientRect();
			const inside = r.top >= ar.top - 0.5 && r.bottom <= ar.bottom + 0.5;
			if (!inside && a !== document.documentElement && a !== document.body)
				faults.push(`clipped by <${a.tagName.toLowerCase()} class="${a.className}">`);
		}
		return faults;
	}, text);
}

test.describe('desktop page on a short viewport (1280×600)', () => {
	const SHORT = { width: 1280, height: 600 };

	test('the page scrolls: content is taller than the viewport', async ({ page }) => {
		skipUnlessDesktopProject(page);
		await page.setViewportSize(SHORT);
		await gotoHydrated(page, '/en/');
		const scrollable = await page.evaluate(() => {
			const scrollers = [document.documentElement, ...document.querySelectorAll('body *')];
			return scrollers.some((el) => {
				const overflow = getComputedStyle(el).overflowY;
				const canScroll =
					el === document.documentElement || overflow === 'auto' || overflow === 'scroll';
				return canScroll && el.scrollHeight > el.clientHeight + 1;
			});
		});
		expect(scrollable, 'got nothing scrollable at 1280×600, want the page to scroll').toBe(true);
	});

	for (const what of ['map', HOME_COPY.en.aboutBody]) {
		const name = what === 'map' ? 'the map' : 'the about paragraph';
		test(`${name} can be scrolled fully into view, unclipped`, async ({ page }) => {
			skipUnlessDesktopProject(page);
			await page.setViewportSize(SHORT);
			await gotoHydrated(page, '/en/');
			const faults = await unclippedOnceScrolled(page, what);
			expect(faults, `got ${name} cut off: ${JSON.stringify(faults)}`).toEqual([]);
		});
	}
});
