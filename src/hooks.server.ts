import type { Handle, HandleServerError, ServerInit } from '@sveltejs/kit/hooks';
import { INTERNAL_SERVER_ERROR } from '#lib/http-status.ts';
import { localeFromPath } from '#lib/i18n/locales.ts';
import { setErrorReporter } from '#lib/report-error.ts';
import { log } from '#lib/server/log.ts';
import { withRequestLocale } from '#lib/server/request-locale.ts';

// src/app.html carries this placeholder; it is replaced on every page.
const HTML_LANG_PLACEHOLDER = '<html lang="%lang%">';

// Shared components (e.g. <Photo>) report server-side errors through the
// structured logger, so those lines carry the trace ID too.
export const init: ServerInit = () => {
	setErrorReporter((msg, err) => log.error(msg, { err }));
};

// An unknown error is a bug: log it once, linked to the request's trace, and
// return nothing so the client gets Kit's generic 500 body. App errors (our
// 404 and 503; orHttpError logs the outage) and framework errors (an unknown
// URL) are expected and not logged.
export const handleError: HandleServerError = ({ kind, error, event }) => {
	if (kind !== 'unknown') return;
	log.error('unhandled error', {
		err: error,
		status: INTERNAL_SERVER_ERROR,
		route: event.route.id
	});
};

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
