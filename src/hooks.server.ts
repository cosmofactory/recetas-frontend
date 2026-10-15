import type { Handle } from '@sveltejs/kit/hooks';
import { localeFromPath } from '#lib/i18n/locales.ts';
import { withRequestLocale } from '#lib/server/request-locale.ts';

// src/app.html carries this placeholder; it is replaced on every page.
const HTML_LANG_PLACEHOLDER = '<html lang="%lang%">';

// The URL path alone decides the language (stack.md X6): /ru/... is Russian
// whatever the cookie says; a path without a locale prefix (a 404 such as
// /fr/) renders in en.
export const handle: Handle = ({ event, resolve }) => {
	const locale = localeFromPath(event.url.pathname);
	return withRequestLocale(locale, () =>
		resolve(event, {
			transformPageChunk: ({ html }) =>
				html.replace(HTML_LANG_PLACEHOLDER, `<html lang="${locale}">`)
		})
	);
};
