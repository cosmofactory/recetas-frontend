import type { Locale } from './locales.ts';

// Any base works: only same-origin, root-relative paths survive the checks.
const PROBE_ORIGIN = 'http://next.invalid';
// eslint-disable-next-line no-control-regex -- control characters are what it rejects
const CONTROL_OR_BACKSLASH = /[\\\u0000-\u001f\u007f]/;
const ENCODED_SEPARATOR = /%2f|%5c/i;

function parsePath(next: string): URL | undefined {
	if (!next.startsWith('/') || next.startsWith('//') || CONTROL_OR_BACKSLASH.test(next)) {
		return undefined;
	}
	if (ENCODED_SEPARATOR.test(next)) return undefined;
	const url = new URL(next, PROBE_ORIGIN);
	return url.origin === PROBE_ORIGIN ? url : undefined;
}

// The /set-lang redirect target: `next` when it is a same-origin path under
// /<to>/ (no open redirect, no header injection), otherwise /<to>/. A path the
// URL parser would rewrite (dot-segments, raw non-ASCII) is not trusted either.
export function safeNext(to: Locale | string, next: string | null): string {
	const fallback = `/${to}/`;
	const url = next ? parsePath(next) : undefined;
	if (!url) return fallback;
	const inLocale = url.pathname === `/${to}` || url.pathname.startsWith(fallback);
	return inLocale && url.pathname + url.search === next ? next : fallback;
}

// The language menu's link: /set-lang sets the cookie and comes back to `next`.
export function setLangHref(to: Locale | string, next: string): string {
	return `/set-lang?to=${encodeURIComponent(to)}&next=${encodeURIComponent(next)}`;
}
