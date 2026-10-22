// Readers for server-rendered HTML (svelte/server output), shared by the SSR
// specs. Plain string work, no runner imports, so any spec can use them.

export type StartTag = { name: string; attrs: Record<string, string> };

// The text a reader sees: no tags, no hydration comments, collapsed spaces.
export function visibleText(html: string): string {
	return html
		.replace(/<!--[\s\S]*?-->/g, '')
		.replace(/<[^>]+>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

export const decodeAmp = (value: string) => value.replaceAll('&amp;', '&');

export function startTags(html: string): StartTag[] {
	const tags = html.replace(/<!--[\s\S]*?-->/g, '').match(/<[a-zA-Z][^>]*>/g) ?? [];
	return tags.map((tag) => ({
		name: /^<([a-zA-Z0-9-]+)/.exec(tag)![1].toLowerCase(),
		attrs: Object.fromEntries(
			[...tag.matchAll(/\s([a-zA-Z:-]+)(?:="([^"]*)")?/g)].map((m) => [m[1], m[2] ?? ''])
		)
	}));
}

export function headingTexts(html: string, level: 1 | 2 | 3): string[] {
	const pattern = new RegExp(`<h${level}\\b[^>]*>([\\s\\S]*?)</h${level}>`, 'g');
	return [...html.matchAll(pattern)].map((m) => visibleText(m[1]));
}

const VOID_TAGS = new Set([
	'area',
	'br',
	'col',
	'hr',
	'img',
	'input',
	'link',
	'meta',
	'source',
	'wbr'
]);
const TAG = /<!--[\s\S]*?-->|<\/?([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*?(\/?)>/g;

// The HTML of the element whose start tag begins at `start`, up to its
// matching end tag (void and self-closed tags don't nest).
export function elementHtml(html: string, start: number): string {
	TAG.lastIndex = start;
	let depth = 0;
	for (let match = TAG.exec(html); match; match = TAG.exec(html)) {
		const [tag, name, selfClosed] = match;
		if (!name || selfClosed || VOID_TAGS.has(name.toLowerCase())) continue;
		depth += tag.startsWith('</') ? -1 : 1;
		if (depth === 0) return html.slice(start, TAG.lastIndex);
	}
	throw new Error('got an unclosed element in the HTML');
}

// Every element carrying `attribute` (e.g. 'data-testid="dish-card"'), as HTML.
export function elementsWith(html: string, attribute: string): string[] {
	const found: string[] = [];
	for (let at = html.indexOf(attribute); at > -1; at = html.indexOf(attribute, at + 1)) {
		found.push(elementHtml(html, html.lastIndexOf('<', at)));
	}
	return found;
}

// The `content` of every <meta> whose `property` (Open Graph) or `name`
// (description, twitter:*) is `key`, in document order.
export function metaContents(html: string, key: string): string[] {
	return startTags(html)
		.filter((t) => t.name === 'meta' && (t.attrs.property === key || t.attrs.name === key))
		.map((t) => decodeAmp(t.attrs.content ?? ''));
}
