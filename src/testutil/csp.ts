import { createHash } from 'node:crypto';

// Readers for a Content-Security-Policy header and the inline scripts it has
// to allow (FE-8 PR 3). Plain string work, no runner imports.

export type Csp = Map<string, string[]>;

// "default-src 'self'; img-src 'self' data:" -> { default-src: ['self'], ... }.
// Directive names are case-insensitive; source values are kept as written.
export function parseCsp(header: string): Csp {
	const csp: Csp = new Map();
	for (const part of header.split(';')) {
		const [name, ...sources] = part.trim().split(/\s+/);
		if (name) csp.set(name.toLowerCase(), sources);
	}
	return csp;
}

// The first directive present in `fallbacks`, in order (CSP Level 3: e.g.
// style-src-elem, then style-src, then default-src).
export function effectiveSources(csp: Csp, ...fallbacks: string[]): string[] | undefined {
	for (const name of fallbacks) {
		const sources = csp.get(name);
		if (sources) return sources;
	}
	return undefined;
}

export const isNonce = (source: string) => /^'nonce-[A-Za-z0-9+/_=-]+'$/.test(source);
export const isHash = (source: string) => /^'sha(256|384|512)-[A-Za-z0-9+/=]+'$/.test(source);

// 'nonce-abc' -> abc.
export const nonceValue = (source: string) => source.slice("'nonce-".length, -1);

// A source that is a host or scheme (anything but a keyword, nonce or hash).
export const isHostOrScheme = (source: string) => !source.startsWith("'");

export type InlineScript = { attrs: Record<string, string>; content: string };

// Data blocks (JSON-LD) are never executed, so CSP does not govern them.
const DATA_BLOCK_TYPES = new Set(['application/ld+json', 'application/json']);

// Every <script> without a src that the browser would execute.
export function executableInlineScripts(html: string): InlineScript[] {
	const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
	return scripts
		.map(([, rawAttrs, content]) => ({ attrs: attributes(rawAttrs), content }))
		.filter(({ attrs }) => attrs.src === undefined && !DATA_BLOCK_TYPES.has(attrs.type ?? ''));
}

function attributes(raw: string): Record<string, string> {
	const pairs = [...raw.matchAll(/([a-zA-Z:-]+)(?:="([^"]*)")?/g)];
	return Object.fromEntries(pairs.map((m) => [m[1].toLowerCase(), m[2] ?? '']));
}

// The 'sha256-…' source that allows this exact script text.
export const sha256Source = (content: string) =>
	`'sha256-${createHash('sha256').update(content).digest('base64')}'`;
