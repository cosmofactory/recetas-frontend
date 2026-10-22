import { APP_ENV, PUBLIC_ORIGIN } from '$app/env/private';
import { isIndexable } from '#lib/server/app-env.ts';
import type { RequestHandler } from './$types';

// Read at request time: APP_ENV is only known at runtime, so this is never
// prerendered. Only prod is crawlable; demo and local disallow everything
// and advertise no sitemap (stage FE-8, Small decisions).
const DISALLOW_ALL = ['User-agent: *', 'Disallow: /'];
const SITEMAP_PATH = '/sitemap.xml';

const allowAll = (origin: string) => [
	'User-agent: *',
	'Allow: /',
	'',
	`Sitemap: ${origin}${SITEMAP_PATH}`
];

export const GET: RequestHandler = () => {
	const lines = isIndexable(APP_ENV) ? allowAll(PUBLIC_ORIGIN) : DISALLOW_ALL;
	return new Response(`${lines.join('\n')}\n`, {
		headers: { 'content-type': 'text/plain; charset=utf-8' }
	});
};
