import { describe, expect, it } from 'vitest';
import { CSP_HEADER, withImgSource, withMediaImgSrc } from './csp';

// FE-8 PR 3: kit.csp is fixed at build time, so `handle` adds the runtime
// MEDIA_BASE_URL origin to img-src on every response that has a policy.

const POLICY = "default-src 'self'; img-src 'self'; script-src 'self' 'nonce-abc'";
const MEDIA = 'https://media.example.test/media';

const withPolicy = (policy?: string) =>
	new Response('body', { headers: policy ? { [CSP_HEADER]: policy } : {} });

describe('withImgSource', () => {
	it('appends the source to img-src only', () => {
		expect(withImgSource(POLICY, 'https://cdn.test')).toBe(
			"default-src 'self'; img-src 'self' https://cdn.test; script-src 'self' 'nonce-abc'"
		);
	});

	it('matches the directive name case-insensitively', () => {
		expect(withImgSource("IMG-SRC 'self'", 'https://cdn.test')).toBe(
			"IMG-SRC 'self' https://cdn.test"
		);
	});

	it('leaves a policy without img-src unchanged', () => {
		expect(withImgSource("default-src 'self'", 'https://cdn.test')).toBe("default-src 'self'");
	});
});

describe('withMediaImgSrc', () => {
	it('adds the media origin, without its path', () => {
		const got = withMediaImgSrc(withPolicy(POLICY), MEDIA).headers.get(CSP_HEADER);
		expect(got).toContain("img-src 'self' https://media.example.test;");
	});

	it('without MEDIA_BASE_URL leaves the policy as it is', () => {
		expect(withMediaImgSrc(withPolicy(POLICY), undefined).headers.get(CSP_HEADER)).toBe(POLICY);
	});

	it('adds no policy to a response without one', () => {
		expect(withMediaImgSrc(withPolicy(), MEDIA).headers.get(CSP_HEADER)).toBeNull();
	});
});
