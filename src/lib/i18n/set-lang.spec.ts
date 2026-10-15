import { describe, expect, it } from 'vitest';
import { loadExport } from '../../testutil/load-export';

// FE-1: /set-lang redirects to `next` only when it is a same-origin path under
// the chosen locale; anything else goes to /<to>/ (no open redirect).

type SafeNext = (to: string, next: string | null) => string;

const load = () => loadExport<SafeNext>('src/lib/i18n/set-lang.ts', 'safeNext');

describe('safeNext', () => {
	const kept: [string, string][] = [
		['ru', '/ru/'],
		['ru', '/ru'],
		['en', '/en/'],
		['es', '/es/dishes/tortilla'],
		['ru', '/ru/dishes/tortilla/gal'],
		['ru', '/ru/regions/gal'],
		['ru', '/ru/?tab=popular'],
		['es', '/es/dishes/tortilla?tab=popular']
	];
	for (const [to, next] of kept) {
		it(`keeps ${next} for to=${to}`, async () => {
			const got = (await load())(to, next);
			expect(got, `got ${got}, want ${next}`).toBe(next);
		});
	}

	const rejected: { name: string; to: string; next: string | null }[] = [
		{ name: 'missing next', to: 'ru', next: null },
		{ name: 'empty next', to: 'ru', next: '' },
		{ name: 'absolute URL', to: 'ru', next: 'https://evil.example' },
		{ name: 'absolute URL with the locale path', to: 'ru', next: 'https://evil.example/ru/' },
		{ name: 'absolute same-host URL', to: 'ru', next: 'http://127.0.0.1:4173/ru/' },
		{ name: 'protocol-relative URL', to: 'ru', next: '//evil.example' },
		{ name: 'protocol-relative URL with the locale path', to: 'ru', next: '//evil.example/ru/' },
		{ name: 'backslash host', to: 'ru', next: '/\\evil.example' },
		{ name: 'backslash host under the locale-like start', to: 'ru', next: '\\\\evil.example/ru/' },
		{ name: 'javascript: URL', to: 'ru', next: 'javascript:alert(1)' },
		{ name: 'relative path', to: 'ru', next: 'ru/dishes' },
		{ name: 'another locale', to: 'ru', next: '/es/dishes/tortilla' },
		{ name: 'a prefix that only starts with the locale', to: 'ru', next: '/rus/' },
		{ name: 'a prefix glued to the locale', to: 'en', next: '/english' },
		{ name: 'dot-segments leaving the locale', to: 'ru', next: '/ru/../es/' },
		{ name: 'encoded dot-segments leaving the locale', to: 'ru', next: '/ru/%2e%2e/es/' },
		{ name: 'encoded slashes', to: 'ru', next: '/%2F%2Fevil.example' },
		{ name: 'encoded backslash', to: 'ru', next: '/%5Cevil.example' },
		{ name: 'CRLF header injection', to: 'ru', next: '/ru/\r\nSet-Cookie: x=1' },
		{ name: 'tab character', to: 'ru', next: '/ru/\tdishes' },
		{ name: 'NUL character', to: 'ru', next: '/ru/\u0000' },
		{ name: 'bare root', to: 'es', next: '/' }
	];
	for (const tc of rejected) {
		it(`falls back to /${tc.to}/ for ${tc.name}`, async () => {
			const got = (await load())(tc.to, tc.next);
			const want = `/${tc.to}/`;
			expect(got, `got ${JSON.stringify(got)}, want ${want}`).toBe(want);
		});
	}
});

// The language menu links to /set-lang through this helper, never a literal.
type SetLangHref = (to: string, next: string) => string;

describe('setLangHref', () => {
	const cases: [string, string, string][] = [
		['ru', '/ru/', '/set-lang?to=ru&next=%2Fru%2F'],
		['es', '/es/dishes/tortilla', '/set-lang?to=es&next=%2Fes%2Fdishes%2Ftortilla'],
		['en', '/en/?tab=popular', '/set-lang?to=en&next=%2Fen%2F%3Ftab%3Dpopular'],
		['ru', '/ru/dishes/tortilla/gal', '/set-lang?to=ru&next=%2Fru%2Fdishes%2Ftortilla%2Fgal']
	];
	for (const [to, next, want] of cases) {
		it(`setLangHref(${to}, ${next}) is ${want}`, async () => {
			const setLangHref = await loadExport<SetLangHref>('src/lib/i18n/set-lang.ts', 'setLangHref');
			const got = setLangHref(to, next);
			expect(got, `got ${got}, want ${want}`).toBe(want);
			const back = new URL(got, 'http://x.invalid').searchParams.get('next');
			expect(back, `got next ${back} after decoding, want ${next}`).toBe(next);
		});
	}
});
