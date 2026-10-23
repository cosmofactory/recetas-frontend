import { FIRST_CLIENT_ERROR, OK } from '#lib/http-status.ts';

// Stage FE-8, Small decisions -> Cache-Control. Hashed /_app/immutable files
// are adapter-node's (immutable); the bare `/` redirect, /healthz and /readyz
// set their own `no-store`.
export const CACHE_CONTROL_HEADER = 'cache-control';
// SSR pages: a minute fresh, then served stale for ten while revalidating.
export const PAGE_CACHE_CONTROL = 'public, max-age=60, stale-while-revalidate=600';
// /sitemap.xml and /robots.txt change only with a catalog import or a deploy.
export const CRAWLER_FILE_CACHE_CONTROL = 'public, max-age=3600';
// Error responses (a shared cache must not pin an outage) and /set-lang.
export const NO_STORE = 'no-store';

const HTML_CONTENT_TYPE = 'text/html';

export const isHtml = (response: Response) =>
	response.headers.get('content-type')?.startsWith(HTML_CONTENT_TYPE) ?? false;

// The one place page and error caching is decided, for every response
// `handle` resolves.
export function withCacheControl(response: Response): Response {
	if (response.status >= FIRST_CLIENT_ERROR) {
		response.headers.set(CACHE_CONTROL_HEADER, NO_STORE);
	} else if (response.status === OK && isHtml(response)) {
		response.headers.set(CACHE_CONTROL_HEADER, PAGE_CACHE_CONTROL);
	}
	return response;
}
