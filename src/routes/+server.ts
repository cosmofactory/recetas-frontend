import { redirect } from '@sveltejs/kit';
import { pickLocale } from '#lib/i18n/pick-locale.ts';
import type { RequestHandler } from './$types';

// A bare `/` sends the visitor to their language's home (stack.md X6): the
// answer depends on the cookie and Accept-Language, so it is never cached.
export const GET: RequestHandler = ({ cookies, request, setHeaders }) => {
	setHeaders({ vary: 'Accept-Language, Cookie', 'cache-control': 'private, no-store' });
	const locale = pickLocale(cookies.get('lang'), request.headers.get('accept-language'));
	redirect(302, `/${locale}/`);
};
