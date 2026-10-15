import { expect, type APIRequestContext, type APIResponse } from '@playwright/test';

// Shared fixtures for the FE-1 i18n/routing Playwright tests.

export const LOCALES = ['en', 'es', 'ru'] as const;
export type Locale = (typeof LOCALES)[number];

// The FE-1 stub pages and the translated <h1> each one renders (strings.json).
// home: desktop.aboutTitle; region: search.groups[2]; dish: search.groups[1];
// recipe: recipe.ingredients.
export const PAGES: { name: string; path: string; h1: Record<Locale, string> }[] = [
	{
		name: 'home',
		path: '/',
		h1: {
			en: 'How Spain really cooks',
			es: 'Así cocina España de verdad',
			ru: 'Как на самом деле готовит Испания'
		}
	},
	{
		name: 'region',
		path: '/regions/gal',
		h1: { en: 'Regions', es: 'Regiones', ru: 'Регионы' }
	},
	{
		name: 'dish',
		path: '/dishes/tortilla',
		h1: { en: 'Variations', es: 'Variantes', ru: 'Варианты' }
	},
	{
		name: 'recipe',
		path: '/dishes/tortilla/gal',
		h1: { en: 'Ingredients', es: 'Ingredientes', ru: 'Ингредиенты' }
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
