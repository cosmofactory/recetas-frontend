import { expect, type Locator, type Page } from '@playwright/test';
import type { Locale } from './e2e';

// Shared fixtures for the FE-4 home shell Playwright specs (home-*.e2e.ts).

// F6: desktop from 860px (DESKTOP_MIN_WIDTH_PX in #lib/ui/breakpoints.ts).
export const DESKTOP_MIN_WIDTH = 860;

export type HomeCopy = {
	regional: string;
	popular: string;
	tabsLabel: string;
	regionsCount: string;
	tapRegion: string;
	clickRegion: string;
	aboutTitle: string;
	aboutBody: string;
	language: string;
	search: string;
};

// strings.json home.* / desktop.*; extra-strings.json a11y.search,
// a11y.homeTabs (the switch's tablist name) and home.region (the plural
// eyebrow; 14 reads as the design's home.regionsCount).
export const HOME_COPY: Record<Locale, HomeCopy> = {
	en: {
		regional: 'Regional',
		popular: 'Popular',
		tabsLabel: 'Browse',
		regionsCount: '14 regions',
		tapRegion: 'Tap a region to preview',
		clickRegion: 'Click a region to explore',
		aboutTitle: 'How Spain really cooks',
		aboutBody:
			'Asadorov is an atlas of Spanish home cooking. Pick a region to see its dishes, or follow one dish across the country — every region cooks it a little differently, and each variation comes with its own recipe.',
		language: 'Language',
		search: 'Search'
	},
	es: {
		regional: 'Regional',
		popular: 'Popular',
		tabsLabel: 'Explorar',
		regionsCount: '14 regiones',
		tapRegion: 'Toca una región',
		clickRegion: 'Haz clic en una región',
		aboutTitle: 'Así cocina España de verdad',
		aboutBody:
			'Asadorov es un atlas de la cocina casera española. Elige una región para ver sus platos o sigue un plato por todo el país: cada región lo cocina a su manera, y cada variante tiene su propia receta.',
		language: 'Idioma',
		search: 'Buscar'
	},
	ru: {
		regional: 'По регионам',
		popular: 'Популярное',
		tabsLabel: 'Обзор',
		regionsCount: '14 регионов',
		tapRegion: 'Нажмите на регион',
		clickRegion: 'Выберите регион на карте',
		aboutTitle: 'Как на самом деле готовит Испания',
		aboutBody:
			'Asadorov — атлас испанской домашней кухни. Выберите регион, чтобы увидеть его блюда, или проследите одно блюдо по всей стране: в каждом регионе его готовят по-своему, и у каждого варианта есть свой рецепт.',
		language: 'Язык',
		search: 'Поиск'
	}
};

export function isDesktopPage(page: Page): boolean {
	return (page.viewportSize()?.width ?? 0) >= DESKTOP_MIN_WIDTH;
}

export function onlyVisible(locator: Locator): Locator {
	return locator.filter({ visible: true });
}

// The map the current layout shows (the hidden layout's copy, if any, excluded).
export function visibleMap(page: Page): Locator {
	return onlyVisible(page.getByTestId('region-map'));
}

export function tab(page: Page, name: string): Locator {
	return page.getByRole('tab', { name, exact: true });
}

export type Box = { x: number; y: number; width: number; height: number };

export async function boxOf(locator: Locator, what: string): Promise<Box> {
	const box = await locator.boundingBox();
	expect(box, `got no box for ${what}, want it rendered`).not.toBeNull();
	return box!;
}

export const right = (box: Box) => box.x + box.width;
export const bottom = (box: Box) => box.y + box.height;

// Lengths agree to half a pixel (sub-pixel layout, fractional clamps).
export const PX_TOLERANCE = 0.5;

export function expectPx(got: number, want: number, what: string, tolerance = PX_TOLERANCE) {
	expect(
		Math.abs(got - want),
		`got ${what} ${got}px, want ${want}px (±${tolerance})`
	).toBeLessThanOrEqual(tolerance);
}

export async function computedStyle(
	locator: Locator,
	properties: string[]
): Promise<Record<string, string>> {
	return locator.evaluate(
		(el, props) =>
			Object.fromEntries(props.map((p) => [p, getComputedStyle(el).getPropertyValue(p)])),
		properties
	);
}

// What `value` (e.g. "var(--border-chip)", "1.5px") computes to for a CSS
// property on this page, so a style is compared with the token, not a copy.
export function tokenValue(
	page: Page,
	property: string,
	value: string,
	base = ''
): Promise<string> {
	return page.evaluate(
		([prop, val, style]) => {
			const probe = document.createElement('div');
			probe.setAttribute('style', style);
			probe.style.setProperty(prop, val);
			document.body.append(probe);
			const got = getComputedStyle(probe).getPropertyValue(prop);
			probe.remove();
			return got;
		},
		[property, value, base] as const
	);
}

// CSS clamp(min, preferred, max).
export const clampPx = (min: number, preferred: number, max: number) =>
	Math.min(Math.max(preferred, min), max);

// Marks the document, so a later check can tell a client-side navigation
// (the mark survives) from a full reload.
export async function markDocument(page: Page) {
	await page.evaluate(() => ((window as unknown as { __homeMark: boolean }).__homeMark = true));
}

export async function expectSameDocument(page: Page, what: string) {
	const kept = await page.evaluate(
		() => (window as unknown as { __homeMark?: boolean }).__homeMark === true
	);
	expect(kept, `got a full reload ${what}, want a client-side navigation`).toBe(true);
}

// Waits until the app has hydrated, so clicks reach Svelte's handlers.
export async function gotoHydrated(page: Page, url: string) {
	const res = await page.goto(url, { waitUntil: 'networkidle' });
	expect(res?.status(), `got status ${res?.status()} for ${url}, want 200`).toBe(200);
}

export function pathAndQuery(page: Page): string {
	const url = new URL(page.url());
	return url.pathname + url.search;
}
