import { PUBLIC_ORIGIN } from '$app/env/private';
import { baseLocale } from '#lib/i18n/locales.ts';
import { catalog } from '#lib/server/catalog.ts';
import { orHttpError } from '#lib/server/load-errors.ts';
import { SITEMAP_CONTENT_TYPE, sitemapXml } from '#lib/seo/sitemap.ts';
import type { RequestHandler } from './$types';

// Built per request from the catalog (it lives behind the runtime API), so
// never prerendered. Served on every APP_ENV: off prod, robots.txt and
// X-Robots-Tag already keep crawlers out. Keys are locale-independent, so
// one locale's lists give every locale's URLs.
export const GET: RequestHandler = async (event) => {
	const [regions, dishes] = await orHttpError(
		Promise.all([catalog().listRegions(baseLocale), catalog().listDishes(baseLocale)]),
		event
	);
	return new Response(sitemapXml(PUBLIC_ORIGIN, { regions, dishes }), {
		headers: { 'content-type': SITEMAP_CONTENT_TYPE }
	});
};
