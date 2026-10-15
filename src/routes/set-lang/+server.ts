import { redirect } from '@sveltejs/kit';
import { isLocale } from '#lib/i18n/locales.ts';
import { safeNext } from '#lib/i18n/set-lang.ts';
import type { RequestHandler } from './$types';

const ONE_YEAR_SECONDS = 31_536_000;
const BAD_REQUEST = 400;

// GET /set-lang?to=<lang>&next=<path>: the language menu's link, and the only
// place that writes a cookie (stack.md X6). Works without JavaScript.
export const GET: RequestHandler = ({ url, cookies }) => {
	const to = url.searchParams.get('to');
	// A hand-edited URL: a bare 400, not an (English) error page.
	if (!isLocale(to)) return new Response(null, { status: BAD_REQUEST });
	cookies.set('lang', to, {
		path: '/',
		maxAge: ONE_YEAR_SECONDS,
		sameSite: 'lax',
		secure: true,
		httpOnly: true
	});
	redirect(303, safeNext(to, url.searchParams.get('next')));
};
