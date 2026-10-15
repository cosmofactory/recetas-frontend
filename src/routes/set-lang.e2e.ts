import { expect, test } from '@playwright/test';
import { getRaw, redirectTarget, setCookieHeaders } from '../testutil/e2e';

// FE-1 acceptance: GET /set-lang?to=<lang>&next=<path> is the only response
// that writes a cookie; it 303s to `next` only when that is a same-origin path
// under /<to>/ (no open redirect). Works without JavaScript.

function setLangUrl(params: Record<string, string>): string {
	return `/set-lang?${new URLSearchParams(params).toString()}`;
}

const redirects: { name: string; params: Record<string, string>; want: string }[] = [
	{
		name: 'a page in the chosen locale',
		params: { to: 'ru', next: '/ru/dishes/tortilla' },
		want: '/ru/dishes/tortilla'
	},
	{ name: 'the chosen home page', params: { to: 'es', next: '/es/' }, want: '/es/' },
	{
		name: 'a query string is kept',
		params: { to: 'en', next: '/en/?tab=popular' },
		want: '/en/?tab=popular'
	},
	{ name: 'no next', params: { to: 'ru' }, want: '/ru/' },
	{ name: 'an absolute URL', params: { to: 'ru', next: 'https://evil.example' }, want: '/ru/' },
	{
		name: 'an absolute URL ending in the locale',
		params: { to: 'ru', next: 'https://evil.example/ru/' },
		want: '/ru/'
	},
	{
		name: 'a protocol-relative URL',
		params: { to: 'ru', next: '//evil.example/ru/' },
		want: '/ru/'
	},
	{ name: 'a backslash host', params: { to: 'ru', next: '/\\evil.example' }, want: '/ru/' },
	{ name: 'encoded slashes', params: { to: 'ru', next: '/%2F%2Fevil.example' }, want: '/ru/' },
	{ name: 'another locale', params: { to: 'ru', next: '/es/dishes/tortilla' }, want: '/ru/' },
	{
		name: 'dot-segments leaving the locale',
		params: { to: 'ru', next: '/ru/../es/' },
		want: '/ru/'
	},
	{ name: 'a CRLF in next', params: { to: 'ru', next: '/ru/\r\nX-Evil: 1' }, want: '/ru/' }
];

test.describe('GET /set-lang', () => {
	for (const tc of redirects) {
		test(`303s to ${tc.want} for ${tc.name}`, async ({ request, baseURL }) => {
			const res = await getRaw(request, setLangUrl(tc.params));
			expect(res.status(), `got status ${res.status()}, want 303`).toBe(303);
			const got = redirectTarget(res, baseURL!);
			expect(got, `got Location ${got}, want ${tc.want}`).toBe(tc.want);
			expect(res.headers()['x-evil'], 'got an injected header, want none').toBeUndefined();
		});
	}

	for (const to of ['en', 'es', 'ru']) {
		test(`sets exactly one lang=${to} cookie with the X6 attributes`, async ({ request }) => {
			const cookies = setCookieHeaders(await getRaw(request, setLangUrl({ to, next: `/${to}/` })));
			expect(cookies.length, `got Set-Cookie ${JSON.stringify(cookies)}, want exactly one`).toBe(1);
			const [pair, ...attrs] = cookies[0].split(';').map((p) => p.trim());
			expect(pair, `got ${pair}, want lang=${to}`).toBe(`lang=${to}`);
			const got = new Set(attrs.map((a) => a.toLowerCase()));
			for (const want of ['path=/', 'max-age=31536000', 'samesite=lax', 'secure', 'httponly']) {
				expect(got.has(want), `got attributes ${JSON.stringify(attrs)}, want ${want}`).toBe(true);
			}
			const domain = attrs.filter((a) => /^domain=/i.test(a));
			expect(domain, `got ${JSON.stringify(domain)}, want a host-only cookie`).toEqual([]);
		});
	}

	const invalid: { name: string; params: Record<string, string> }[] = [
		{ name: 'an unknown locale', params: { to: 'fr', next: '/fr/' } },
		{ name: 'a junk locale', params: { to: 'xx' } },
		{ name: 'an upper-case locale', params: { to: 'RU', next: '/ru/' } },
		{ name: 'an empty locale', params: { to: '' } },
		{ name: 'no locale', params: { next: '/ru/' } }
	];
	for (const tc of invalid) {
		test(`returns 400 without a cookie for ${tc.name}`, async ({ request }) => {
			const res = await getRaw(request, setLangUrl(tc.params));
			expect(res.status(), `got status ${res.status()}, want 400`).toBe(400);
			const cookies = setCookieHeaders(res);
			expect(cookies, `got Set-Cookie ${JSON.stringify(cookies)}, want none`).toEqual([]);
		});
	}

	// The 400 is for a hand-edited URL: no HTML error page with English copy.
	const accepts: { name: string; params: Record<string, string>; accept?: string }[] = [
		{ name: 'to=xx', params: { to: 'xx' } },
		{ name: 'to=xx from a browser', params: { to: 'xx', next: '/ru/' }, accept: 'text/html' },
		{ name: 'no to from a browser', params: { next: '/ru/' }, accept: 'text/html,*/*;q=0.8' }
	];
	for (const tc of accepts) {
		test(`400 for ${tc.name} has no prose body and no cookie`, async ({ request }) => {
			const headers: Record<string, string> = tc.accept ? { accept: tc.accept } : {};
			const res = await getRaw(request, setLangUrl(tc.params), headers);
			expect(res.status(), `got status ${res.status()}, want 400`).toBe(400);
			expect(setCookieHeaders(res), 'got a Set-Cookie, want none').toEqual([]);
			const type = res.headers()['content-type'] ?? '';
			const body = (await res.text()).trim();
			expect(type, `got content-type ${type}, want no HTML page`).not.toMatch(/html/i);
			expect(body, `got body ${JSON.stringify(body.slice(0, 120))}, want no prose`).not.toMatch(
				/[A-Za-z]{2,}/
			);
		});
	}
});
