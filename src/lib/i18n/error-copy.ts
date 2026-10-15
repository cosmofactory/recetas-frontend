import { m } from '#lib/paraglide/messages.js';
import type { Locale } from './locales.ts';

const NOT_FOUND = 404;

// The error page's text. The locale is passed explicitly because an error
// page may sit under a path with no locale prefix (/fr/).
export function errorCopy(status: number, locale: Locale) {
	const options = { locale };
	const notFound = status === NOT_FOUND;
	return {
		title: notFound ? m.errors_notFoundTitle({}, options) : m.errors_serverErrorTitle({}, options),
		body: notFound ? m.errors_notFoundBody({}, options) : m.errors_serverErrorBody({}, options),
		backHome: m.errors_backHome({}, options)
	};
}
