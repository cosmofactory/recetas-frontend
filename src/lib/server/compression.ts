import { isHtml } from '#lib/server/cache-control.ts';

// Stage FE-8 PR 4 (D-FE8-2): adapter-node serves the static files
// precompressed but sends SSR pages as they are, and the document is on the
// critical path of every first load (on the mobile Lighthouse profile a 50 KB
// page costs an extra round trip), so `handle` gzips HTML. A proxy in front
// (Caddy `encode`) leaves a response that is already encoded alone.
export const CONTENT_ENCODING_HEADER = 'content-encoding';
export const ACCEPT_ENCODING_HEADER = 'accept-encoding';
export const GZIP = 'gzip';
const CONTENT_LENGTH_HEADER = 'content-length';
const VARY_HEADER = 'vary';
const ETAG_HEADER = 'etag';
const WEAK_ETAG_PREFIX = 'W/';
const ZERO_QUALITY = /^q=0(\.0{0,3})?$/;

// "gzip, deflate, br" and "gzip;q=0.8" accept it; "br", "identity" and
// "gzip;q=0" don't. Browsers always name gzip, so `*` isn't honoured.
export function acceptsGzip(acceptEncoding: string | null): boolean {
	return (acceptEncoding ?? '').split(',').some((entry) => {
		const [coding, ...params] = entry.split(';').map((part) => part.trim().toLowerCase());
		return coding === GZIP && !params.some((param) => ZERO_QUALITY.test(param));
	});
}

// Every HTML response varies on Accept-Encoding, so a shared cache never
// hands the gzip body to a client that didn't ask for it.
export function withGzip(request: Request, response: Response): Response {
	if (!response.body || !isHtml(response) || response.headers.has(CONTENT_ENCODING_HEADER)) {
		return response;
	}
	response.headers.append(VARY_HEADER, ACCEPT_ENCODING_HEADER);
	if (!acceptsGzip(request.headers.get(ACCEPT_ENCODING_HEADER))) return response;
	return new Response(response.body.pipeThrough(new CompressionStream(GZIP)), {
		status: response.status,
		statusText: response.statusText,
		headers: gzipHeaders(response.headers)
	});
}

// The gzip body is another representation, so a strong ETag becomes weak (as
// nginx does). Kit never answers it with a 304, which costs nothing: every
// page carries a per-response CSP nonce, so its ETag never repeats anyway.
function gzipHeaders(original: Headers): Headers {
	const headers = new Headers(original);
	headers.set(CONTENT_ENCODING_HEADER, GZIP);
	headers.delete(CONTENT_LENGTH_HEADER);
	const etag = headers.get(ETAG_HEADER);
	if (etag && !etag.startsWith(WEAK_ETAG_PREFIX)) {
		headers.set(ETAG_HEADER, `${WEAK_ETAG_PREFIX}${etag}`);
	}
	return headers;
}
