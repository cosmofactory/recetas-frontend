import { describe, expect, it } from 'vitest';
import {
	CACHE_CONTROL_HEADER,
	NO_STORE,
	PAGE_CACHE_CONTROL,
	withCacheControl
} from './cache-control';

// FE-8 PR 3 (stage FE-8, Small decisions -> Cache-Control): `handle` gives
// 200 HTML pages the public page policy and every error `no-store`; other
// responses keep what their route set.

const HTML = 'text/html; charset=utf-8';

function response(status: number, headers: Record<string, string> = {}) {
	return new Response('body', { status, headers });
}

const policyOf = (res: Response) => withCacheControl(res).headers.get(CACHE_CONTROL_HEADER);

describe('withCacheControl', () => {
	it('a 200 HTML page gets the page policy', () => {
		expect(policyOf(response(200, { 'content-type': HTML }))).toBe(PAGE_CACHE_CONTROL);
	});

	for (const status of [400, 404, 500, 503]) {
		it(`a ${status} gets no-store, whatever it set`, () => {
			const res = response(status, { 'content-type': HTML, [CACHE_CONTROL_HEADER]: 'public' });
			expect(policyOf(res)).toBe(NO_STORE);
		});
	}

	it('a non-HTML 200 keeps its own policy', () => {
		const res = response(200, { 'content-type': 'application/xml', [CACHE_CONTROL_HEADER]: 'x' });
		expect(policyOf(res)).toBe('x');
	});

	it('a redirect is left alone', () => {
		expect(policyOf(response(302, { location: '/en/' }))).toBeNull();
	});
});
