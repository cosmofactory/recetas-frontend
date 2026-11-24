import { FIRST_CLIENT_ERROR, MOVED_PERMANENTLY, OK, PERMANENT_REDIRECT } from '#lib/http-status.ts';

// Stage FE-8, Small decisions -> Cache-Control. Hashed /_app/immutable files
// are adapter-node's (immutable); the bare `/` redirect, /healthz and /readyz
// set their own `no-store`.
export const CACHE_CONTROL_HEADER = 'cache-control';
// SSR pages: a minute fresh, then served stale for ten while revalidating.
export const PAGE_CACHE_CONTROL = 'public, max-age=60, stale-while-revalidate=600';
// /sitemap.xml and /robots.txt change only with a catalog import or a deploy.
export const CRAWLER_FILE_CACHE_CONTROL = 'public, max-age=3600';
// A permanent redirect (a one-variation dish's URL, FE-11) is otherwise
// cached by browsers indefinitely; five minutes lets it lapse once the dish
// gains a Variations page.
export const REDIRECT_CACHE_CONTROL = 'public, max-age=300';
// Error responses (a shared cache must not pin an outage) and /set-lang.
export const NO_STORE = 'no-store';

const HTML_CONTENT_TYPE = 'text/html';
const PERMANENT_REDIRECTS: readonly number[] = [MOVED_PERMANENTLY, PERMANENT_REDIRECT];

export const isHtml = (response: Response) =>
	response.headers.get('content-type')?.startsWith(HTML_CONTENT_TYPE) ?? false;

// The one place page and error caching is decided, for every response
// `handle` resolves. Temporary redirects keep what their route set (`/`
// and /set-lang: no-store); browsers don't cache them by heuristic.
export function withCacheControl(response: Response): Response {
	const policy = policyFor(response);
	if (policy) response.headers.set(CACHE_CONTROL_HEADER, policy);
	return response;
}

function policyFor(response: Response): string | undefined {
	const { status, headers } = response;
	if (status >= FIRST_CLIENT_ERROR) return NO_STORE;
	if (status === OK && isHtml(response)) return PAGE_CACHE_CONTROL;
	if (PERMANENT_REDIRECTS.includes(status) && !headers.has(CACHE_CONTROL_HEADER)) {
		return REDIRECT_CACHE_CONTROL;
	}
	return undefined;
}
