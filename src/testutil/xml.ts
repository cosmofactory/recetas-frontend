// A strict little XML reader for the sitemap specs (FE-8 PR 2): enough of
// XML 1.0 to check a sitemap's structure without a parser dependency (no
// network for the XSD either). It throws on anything a sitemap must not
// contain: a stray `<`, a bare `&` or an unknown entity, an unclosed or
// mismatched tag, comments, CDATA, or content after the root. Plain string
// work, no runner imports, so the Playwright specs can use it too.

export type XmlElement = {
	name: string;
	attrs: Record<string, string>;
	children: XmlElement[];
	text: string;
};

export type XmlDocument = { declaration: string | null; root: XmlElement };

const DECLARATION = /^<\?xml\s[^?]*\?>/;
// One token at the cursor: a start, end or empty-element tag, or text.
const TOKEN = /<(\/?)([A-Za-z_][\w:.-]*)((?:\s+[\w:.-]+\s*=\s*"[^"<]*")*)\s*(\/?)>|([^<]+)/y;
const ATTRIBUTE = /([\w:.-]+)\s*=\s*"([^"]*)"/g;
const ENTITIES: Record<string, string> = {
	amp: '&',
	lt: '<',
	gt: '>',
	quot: '"',
	apos: "'"
};
const ENTITY = /&(#x[0-9a-fA-F]+|#[0-9]+|[a-z]+);/g;
const BARE_AMPERSAND = /&(?!(#x[0-9a-fA-F]+|#[0-9]+|amp|lt|gt|quot|apos);)/;

// Text or an attribute value with its entities decoded.
export function decodeXml(raw: string): string {
	if (BARE_AMPERSAND.test(raw)) throw new Error(`got a bare & in ${JSON.stringify(raw)}`);
	return raw.replace(ENTITY, (_, name: string) => {
		if (name.startsWith('#x')) return String.fromCodePoint(parseInt(name.slice(2), 16));
		if (name.startsWith('#')) return String.fromCodePoint(Number(name.slice(1)));
		return ENTITIES[name];
	});
}

function parseAttrs(raw: string): Record<string, string> {
	const attrs: Record<string, string> = {};
	for (const [, name, value] of raw.matchAll(ATTRIBUTE)) {
		if (name in attrs) throw new Error(`got a duplicate attribute ${name}`);
		attrs[name] = decodeXml(value);
	}
	return attrs;
}

type Cursor = { stack: XmlElement[]; root: XmlElement | null };

function openElement(cursor: Cursor, name: string, attrs: string): XmlElement {
	if (cursor.root && cursor.stack.length === 0) throw new Error(`got <${name}> after the root`);
	const element: XmlElement = { name, attrs: parseAttrs(attrs), children: [], text: '' };
	cursor.stack.at(-1)?.children.push(element);
	cursor.root ??= element;
	return element;
}

function closeElement(cursor: Cursor, name: string): void {
	const open = cursor.stack.pop();
	if (open?.name !== name) throw new Error(`got </${name}>, want </${open?.name ?? '(none)'}>`);
}

function addText(cursor: Cursor, raw: string): void {
	const parent = cursor.stack.at(-1);
	if (!parent) {
		if (raw.trim()) throw new Error(`got text outside the root: ${JSON.stringify(raw)}`);
		return;
	}
	parent.text += decodeXml(raw);
}

function step(cursor: Cursor, match: RegExpExecArray): void {
	const [, slash, name, attrs, selfClosed, text] = match;
	if (text !== undefined) return addText(cursor, text);
	if (slash) return closeElement(cursor, name);
	const element = openElement(cursor, name, attrs);
	if (!selfClosed) cursor.stack.push(element);
}

export function parseXml(xml: string): XmlDocument {
	const declaration = DECLARATION.exec(xml)?.[0] ?? null;
	const cursor: Cursor = { stack: [], root: null };
	TOKEN.lastIndex = declaration?.length ?? 0;
	while (TOKEN.lastIndex < xml.length) {
		const at = TOKEN.lastIndex;
		const match = TOKEN.exec(xml);
		if (!match) throw new Error(`got unexpected XML at ${at}: ${xml.slice(at, at + 40)}`);
		step(cursor, match);
	}
	if (!cursor.root || cursor.stack.length > 0)
		throw new Error('got no root or an unclosed element');
	return { declaration, root: cursor.root };
}

export const childrenNamed = (element: XmlElement, name: string) =>
	element.children.filter((child) => child.name === name);
