import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import {
	ACCEPT_ENCODING_HEADER,
	CONTENT_ENCODING_HEADER,
	GZIP,
	acceptsGzip,
	withGzip
} from './compression';

// FE-8 PR 4 (D-FE8-2): `handle` gzips SSR HTML for clients that accept it,
// because adapter-node only compresses static files.

const HTML = 'text/html; charset=utf-8';
const PAGE = '<!doctype html><html><body>Asadorov</body></html>';

const request = (acceptEncoding?: string) =>
	new Request('http://app.test/en/', {
		headers: acceptEncoding ? { [ACCEPT_ENCODING_HEADER]: acceptEncoding } : {}
	});

const page = (headers: Record<string, string> = {}) =>
	new Response(PAGE, {
		status: 200,
		headers: { 'content-type': HTML, 'content-length': String(PAGE.length), ...headers }
	});

describe('acceptsGzip', () => {
	const cases: [string | null, boolean][] = [
		['gzip, deflate, br, zstd', true],
		['br;q=1.0, gzip;q=0.8', true],
		['GZIP', true],
		['gzip;q=0', false],
		['gzip; q=0.000', false],
		['br, identity', false],
		['*', false],
		['', false],
		[null, false]
	];
	for (const [header, expected] of cases) {
		it(`${JSON.stringify(header)} -> ${expected}`, () => {
			expect(acceptsGzip(header)).toBe(expected);
		});
	}
});

describe('withGzip', () => {
	it('gzips an HTML page when the client accepts gzip', async () => {
		const res = withGzip(request('gzip, br'), page());
		expect(res.headers.get(CONTENT_ENCODING_HEADER)).toBe(GZIP);
		expect(res.headers.get('content-length')).toBeNull();
		expect(res.headers.get('vary')).toBe(ACCEPT_ENCODING_HEADER);
		const body = Buffer.from(await res.arrayBuffer());
		expect(gunzipSync(body).toString()).toBe(PAGE);
	});

	it('keeps the status, the other headers and appends to an existing Vary', () => {
		const res = withGzip(
			request('gzip'),
			page({ 'content-security-policy': "default-src 'self'", vary: 'Origin' })
		);
		expect(res.status).toBe(200);
		expect(res.headers.get('content-security-policy')).toBe("default-src 'self'");
		expect(res.headers.get('vary')).toBe(`Origin, ${ACCEPT_ENCODING_HEADER}`);
	});

	it('makes a strong ETag weak and leaves a weak one alone', () => {
		expect(withGzip(request('gzip'), page({ etag: '"abc"' })).headers.get('etag')).toBe('W/"abc"');
		expect(withGzip(request('gzip'), page({ etag: 'W/"abc"' })).headers.get('etag')).toBe(
			'W/"abc"'
		);
	});

	it('sends the page as it is, with Vary, to a client without gzip', async () => {
		const res = withGzip(request('br'), page());
		expect(res.headers.get(CONTENT_ENCODING_HEADER)).toBeNull();
		expect(res.headers.get('vary')).toBe(ACCEPT_ENCODING_HEADER);
		expect(await res.text()).toBe(PAGE);
	});

	it('leaves a non-HTML response alone', () => {
		const res = new Response('User-agent: *', { headers: { 'content-type': 'text/plain' } });
		expect(withGzip(request('gzip'), res)).toBe(res);
		expect(res.headers.get('vary')).toBeNull();
	});

	it('leaves an already encoded response alone', () => {
		const res = page({ [CONTENT_ENCODING_HEADER]: 'br' });
		expect(withGzip(request('gzip'), res)).toBe(res);
	});

	it('leaves a response without a body alone', () => {
		const res = new Response(null, { status: 304, headers: { 'content-type': HTML } });
		expect(withGzip(request('gzip'), res)).toBe(res);
	});
});
