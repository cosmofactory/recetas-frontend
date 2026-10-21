import { expect, type APIRequestContext, type APIResponse } from '@playwright/test';

// Shared fixtures for the FE-1 i18n/routing Playwright tests.

export const LOCALES = ['en', 'es', 'ru'] as const;
export type Locale = (typeof LOCALES)[number];

// The pages and a localised text each one server-renders. `h1: true` when
// that text is the page's <h1>. home: desktop.aboutTitle (strings.json), the
// h1 of the desktop "How Spain really cooks" block (FE-4); region: the
// localised region name, an <h2> in the region sheet / panel (FE-4 PR 3:
// the page's <h1> stays the logo / the about title); dish and
// recipe: the dish and variation name from the catalog (DATA_SOURCE=mock
// serves the bundle).
export type PageFixture = {
	name: string;
	path: string;
	text: Record<Locale, string>;
	h1: boolean;
};

export const PAGES: PageFixture[] = [
	{
		name: 'home',
		path: '/',
		text: {
			en: 'How Spain really cooks',
			es: 'Así cocina España de verdad',
			ru: 'Как на самом деле готовит Испания'
		},
		h1: true
	},
	{
		name: 'region',
		path: '/regions/gal',
		text: { en: 'Galicia', es: 'Galicia', ru: 'Галисия' },
		h1: false
	},
	{
		name: 'dish',
		path: '/dishes/tortilla',
		text: { en: 'Tortilla de patatas', es: 'Tortilla de patatas', ru: 'Тортилья' },
		h1: true
	},
	{
		name: 'recipe',
		path: '/dishes/tortilla/gal',
		text: {
			en: 'Betanzos-style runny',
			es: 'Estilo Betanzos, jugosa',
			ru: 'По-бетансосски, жидкая внутри'
		},
		h1: true
	}
];

// "/" -> "/ru/", "/dishes/tortilla" -> "/ru/dishes/tortilla".
export function localePath(locale: string, path: string): string {
	return `/${locale}${path}`;
}

// GET without following redirects.
export function getRaw(
	request: APIRequestContext,
	url: string,
	headers: Record<string, string> = {}
): Promise<APIResponse> {
	return request.get(url, { maxRedirects: 0, headers });
}

// The same-origin path (+ query) a redirect points to.
export function redirectTarget(res: APIResponse, baseURL: string): string {
	const location = res.headers()['location'];
	expect(location, `got no Location header (status ${res.status()}), want one`).toBeTruthy();
	const url = new URL(location, baseURL);
	expect(url.origin, `got redirect to ${location}, want same origin`).toBe(new URL(baseURL).origin);
	return url.pathname + url.search;
}

export function setCookieHeaders(res: APIResponse): string[] {
	return res
		.headersArray()
		.filter((h) => h.name.toLowerCase() === 'set-cookie')
		.map((h) => h.value);
}

// Comma-separated header values, lower-cased and trimmed.
export function headerTokens(res: APIResponse, name: string): string[] {
	const raw = res.headers()[name.toLowerCase()] ?? '';
	return raw
		.split(',')
		.map((t) => t.trim().toLowerCase())
		.filter(Boolean);
}

export function htmlLang(html: string): string | undefined {
	return /<html\b[^>]*\blang="([^"]*)"/i.exec(html)?.[1];
}
