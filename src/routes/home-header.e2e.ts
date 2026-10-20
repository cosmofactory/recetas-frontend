import { expect, test, type Locator, type Page } from '@playwright/test';
import { LOCALES } from '../testutil/e2e';
import {
	bottom,
	boxOf,
	computedStyle,
	expectPx,
	gotoHydrated,
	HOME_COPY,
	isDesktopPage,
	onlyVisible,
	right,
	tab,
	tokenValue
} from '../testutil/home-e2e';

// FE-4 PR 2, the home header (stage FE-4 -> Header: "Logo "Asadorov" (never
// translated), the language button (... a placeholder is fine until FE-7),
// the search button (opens the overlay from FE-7), and the segmented switch
// Regional | Popular, all with translated labels").
//
// Mobile (< 860px, `.mobile-only`), mobile README -> Screen 1 -> Header and
// the 2a frame of Asadorov Explorations.dc.html (l.240–252):
// - "Header (padding 22px 20px 0, column, gap 16px)"
// - "Row, space-between, centred vertically"; logo "Instrument Serif 28px,
//   ink"; "Right group (flex, gap 8px): Language button, then Search button".
// - Language button: "height 40px, padding 0 12px 0 14px, pill, 1.5px
//   --border-chip, 12px/700, letter-spacing .08em: current code ("EN" /
//   "ES" / "RU") + small ▾". Assumption: 40px is its outer height, like the
//   search IconButton beside it (FE-3 built that one 40×40 border-box), so
//   the two read as one row; like every control its hit area is 44px.
//   Until FE-7 it opens nothing: aria-expanded="false"; its accessible name
//   is the visible code plus the localized "Language" (as on desktop).
// - Search button: the FE-3 IconButton, named by a11y.search.
// - Switch: SegmentedSwitch (FE-3 tests its styles), full header width.
//
// Desktop (≥ 860px, `.desktop-only`): DesktopTopBar (FE-3 tests its
// geometry) wired with the same tab data, the localized language label and
// a home link per locale. Exactly one header is visible at any width.

const MOBILE_HEADER = { top: 22, side: 20, gap: 16 };
const LANGUAGE_BUTTON = { height: 40, paddingLeft: 14, paddingRight: 12, fontSize: 12 };
const RIGHT_GROUP_GAP = 8;
const LOGO_SIZE = 28;
const HIT_MIN = 44;
// Desktop README -> Top bar "height 76px, hairline bottom border" (content-box, FE-3).
const TOP_BAR_OUTER_HEIGHT = 77;

function skipUnlessMobile(page: Page) {
	test.skip(isDesktopPage(page), 'mobile header: below 860px only');
}

function skipUnlessDesktop(page: Page) {
	test.skip(!isDesktopPage(page), 'desktop top bar: from 860px only');
}

const logo = (page: Page) => onlyVisible(page.getByText('Asadorov', { exact: true }));

function languageButton(page: Page, label: string): Locator {
	return page.getByRole('button', { name: new RegExp(label) });
}

const searchButton = (page: Page, label: string) =>
	page.getByRole('button', { name: label, exact: true });

// Whether a pointer `dy` px above and below the centre still hits the control.
function hitsAtCentreOffset(control: Locator, dy: number): Promise<boolean> {
	return control.evaluate((el, offset) => {
		const r = el.getBoundingClientRect();
		const x = r.left + r.width / 2;
		const y = r.top + r.height / 2;
		const hit = (py: number) => {
			const target = document.elementFromPoint(x, py);
			return target !== null && (target === el || el.contains(target));
		};
		return hit(y - offset) && hit(y + offset);
	}, dy);
}

test.describe('exactly one header at every width', () => {
	for (const locale of LOCALES) {
		test(`/${locale}/ shows one logo, one switch and one language button`, async ({ page }) => {
			const copy = HOME_COPY[locale];
			await gotoHydrated(page, `/${locale}/`);
			await expect(logo(page), 'want one visible "Asadorov" logo').toHaveCount(1);
			await expect(page.getByRole('tablist'), 'want one visible switch').toHaveCount(1);
			await expect(languageButton(page, copy.language)).toHaveCount(1);
			await expect(tab(page, copy.regional)).toBeVisible();
			await expect(tab(page, copy.popular)).toBeVisible();
		});
	}

	test('the language button is a placeholder until FE-7: not expanded', async ({ page }) => {
		await gotoHydrated(page, '/en/');
		await expect(languageButton(page, HOME_COPY.en.language)).toHaveAttribute(
			'aria-expanded',
			'false'
		);
	});

	for (const locale of LOCALES) {
		test(`the language button shows the code ${locale.toUpperCase()}`, async ({ page }) => {
			await gotoHydrated(page, `/${locale}/`);
			const button = languageButton(page, HOME_COPY[locale].language);
			await expect(button).toContainText(locale.toUpperCase());
		});
	}
});

test.describe('mobile header (< 860px)', () => {
	for (const locale of LOCALES) {
		test(`/${locale}/ has a search button named "${HOME_COPY[locale].search}"`, async ({
			page
		}) => {
			skipUnlessMobile(page);
			await gotoHydrated(page, `/${locale}/`);
			await expect(searchButton(page, HOME_COPY[locale].search)).toBeVisible();
		});
	}

	test('logo: Instrument Serif 28px in ink, 20px from the left', async ({ page }) => {
		skipUnlessMobile(page);
		await gotoHydrated(page, '/en/');
		const style = await computedStyle(logo(page), ['font-size', 'font-family', 'color']);
		expect(style['font-size']).toBe(`${LOGO_SIZE}px`);
		expect(style['font-family'].replace(/["']/g, '')).toMatch(/^Instrument Serif\s*,/);
		expect(style.color).toBe(await tokenValue(page, 'color', 'var(--ink)'));
		expectPx((await boxOf(logo(page), 'the logo')).x, MOBILE_HEADER.side, 'logo left');
	});

	test('row: buttons 22px from the top, search 20px from the right, gap 8px', async ({ page }) => {
		skipUnlessMobile(page);
		await gotoHydrated(page, '/en/');
		const language = await boxOf(languageButton(page, 'Language'), 'the language button');
		const search = await boxOf(searchButton(page, 'Search'), 'the search button');
		const width = await page.evaluate(() => document.documentElement.clientWidth);
		expectPx(language.y, MOBILE_HEADER.top, 'language button top');
		expectPx(search.y, MOBILE_HEADER.top, 'search button top');
		expectPx(right(search), width - MOBILE_HEADER.side, 'search button right');
		expectPx(search.x - right(language), RIGHT_GROUP_GAP, 'gap language → search');
	});

	test('row: the logo is centred on the buttons', async ({ page }) => {
		skipUnlessMobile(page);
		await gotoHydrated(page, '/en/');
		const logoBox = await boxOf(logo(page), 'the logo');
		const search = await boxOf(searchButton(page, 'Search'), 'the search button');
		const centre = (b: { y: number; height: number }) => b.y + b.height / 2;
		expectPx(centre(logoBox), centre(search), 'logo vertical centre', 1);
	});

	test('language button: 40px tall, padding 0 12px 0 14px, 12px/700, .08em', async ({ page }) => {
		skipUnlessMobile(page);
		await gotoHydrated(page, '/en/');
		const button = languageButton(page, 'Language');
		const style = await computedStyle(button, [
			'padding-left',
			'padding-right',
			'font-size',
			'font-weight',
			'letter-spacing'
		]);
		expectPx((await boxOf(button, 'the language button')).height, LANGUAGE_BUTTON.height, 'height');
		expect(style['padding-left']).toBe(`${LANGUAGE_BUTTON.paddingLeft}px`);
		expect(style['padding-right']).toBe(`${LANGUAGE_BUTTON.paddingRight}px`);
		expect(style['font-size']).toBe(`${LANGUAGE_BUTTON.fontSize}px`);
		expect(style['font-weight']).toBe('700');
		expectPx(
			parseFloat(style['letter-spacing']),
			0.08 * LANGUAGE_BUTTON.fontSize,
			'tracking',
			0.01
		);
	});

	test('language button: pill with a 1.5px --border-chip border', async ({ page }) => {
		skipUnlessMobile(page);
		await gotoHydrated(page, '/en/');
		const button = languageButton(page, 'Language');
		const style = await computedStyle(button, [
			'border-top-width',
			'border-top-color',
			'border-top-style',
			'border-top-left-radius'
		]);
		const solid = 'border-style: solid';
		expect(style['border-top-style']).toBe('solid');
		expect(style['border-top-width']).toBe(
			await tokenValue(page, 'border-top-width', '1.5px', solid)
		);
		expect(style['border-top-color']).toBe(
			await tokenValue(page, 'border-top-color', 'var(--border-chip)')
		);
		const radius = parseFloat(style['border-top-left-radius']);
		const height = (await boxOf(button, 'the language button')).height;
		expect(radius, `got radius ${radius}px, want a pill`).toBeGreaterThanOrEqual(height / 2);
	});

	test('language button: same height as the search button', async ({ page }) => {
		skipUnlessMobile(page);
		await gotoHydrated(page, '/en/');
		const language = await boxOf(languageButton(page, 'Language'), 'the language button');
		const search = await boxOf(searchButton(page, 'Search'), 'the search button');
		expectPx(language.height, search.height, 'language vs search height');
	});

	test('language button: a 44px hit area', async ({ page }) => {
		skipUnlessMobile(page);
		await gotoHydrated(page, '/en/');
		const reach = (HIT_MIN - 1) / 2;
		const hits = await hitsAtCentreOffset(languageButton(page, 'Language'), reach);
		expect(hits, `want the button hit ${reach}px above and below its centre`).toBe(true);
	});

	// Accessibility: "All tap targets ≥ 44px tall" (PR 2 QA, at 390×844):
	// a pointer 21.5px above and below each control's centre still hits it.
	test('at 390×844 the header controls answer hits over 44px tall', async ({ page }) => {
		skipUnlessMobile(page);
		await page.setViewportSize({ width: 390, height: 844 });
		await gotoHydrated(page, '/en/');
		const reach = (HIT_MIN - 1) / 2;
		const controls: [string, Locator][] = [
			['language button', languageButton(page, 'Language')],
			['search button', searchButton(page, 'Search')],
			['Regional tab', tab(page, HOME_COPY.en.regional)],
			['Popular tab', tab(page, HOME_COPY.en.popular)]
		];
		for (const [name, control] of controls) {
			const hits = await hitsAtCentreOffset(control, reach);
			expect(hits, `want the ${name} hit ${reach}px above and below its centre`).toBe(true);
		}
	});

	test('switch: 16px under the row, spanning the header width', async ({ page }) => {
		skipUnlessMobile(page);
		await gotoHydrated(page, '/en/');
		const search = await boxOf(searchButton(page, 'Search'), 'the search button');
		const track = await boxOf(page.getByRole('tablist'), 'the switch');
		const width = await page.evaluate(() => document.documentElement.clientWidth);
		expectPx(track.y - bottom(search), MOBILE_HEADER.gap, 'row → switch gap');
		expectPx(track.x, MOBILE_HEADER.side, 'switch left');
		expectPx(right(track), width - MOBILE_HEADER.side, 'switch right');
	});

	test('Russian tab labels fit at this width (no truncation)', async ({ page }) => {
		skipUnlessMobile(page);
		await gotoHydrated(page, '/ru/');
		for (const name of [HOME_COPY.ru.regional, HOME_COPY.ru.popular]) {
			const fits = await tab(page, name).evaluate((el) => el.scrollWidth <= el.clientWidth + 1);
			expect(fits, `got "${name}" wider than its tab`).toBe(true);
		}
	});
});

test.describe('desktop top bar (≥ 860px)', () => {
	for (const locale of LOCALES) {
		test(`/${locale}/: the logo links to /${locale}/`, async ({ page }) => {
			skipUnlessDesktop(page);
			await gotoHydrated(page, `/${locale}/`);
			const link = onlyVisible(page.getByRole('link', { name: 'Asadorov', exact: true }));
			await expect(link).toHaveAttribute('href', `/${locale}/`);
		});
	}

	test('the visible header is the desktop top bar, 76px plus its hairline', async ({ page }) => {
		skipUnlessDesktop(page);
		await gotoHydrated(page, '/en/');
		const header = onlyVisible(page.locator('header')).filter({ has: page.getByRole('tablist') });
		await expect(header).toHaveCount(1);
		expectPx((await boxOf(header, 'the top bar')).height, TOP_BAR_OUTER_HEIGHT, 'top bar height');
	});
});
