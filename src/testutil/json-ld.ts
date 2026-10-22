// Readers for the JSON-LD blocks in server HTML (FE-8 PR 2), shared by the
// SSR specs and the Playwright specs: plain string work, no runner imports.

export type JsonLdNode = Record<string, unknown>;

const SCRIPT = /<script\b[^>]*\btype="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;

// The raw text of every <script type="application/ld+json">, in order.
export function jsonLdScripts(html: string): string[] {
	return [...html.matchAll(SCRIPT)].map((match) => match[1]);
}

// Every script's top-level object (an array counts as several), parsed.
export function jsonLdDocuments(html: string): JsonLdNode[] {
	return jsonLdScripts(html).flatMap((text) => [JSON.parse(text)].flat() as JsonLdNode[]);
}

// Every node, with a document's @graph flattened into its members.
export function jsonLdNodes(html: string): JsonLdNode[] {
	return jsonLdDocuments(html).flatMap((doc) =>
		Array.isArray(doc['@graph']) ? (doc['@graph'] as JsonLdNode[]) : [doc]
	);
}

const hasType = (node: JsonLdNode, type: string) => [node['@type']].flat().includes(type);

export function nodesOfType(html: string, type: string): JsonLdNode[] {
	return jsonLdNodes(html).filter((node) => hasType(node, type));
}

// The one node of `type`; throws (with what was found) otherwise.
export function onlyNodeOfType(html: string, type: string): JsonLdNode {
	const found = nodesOfType(html, type);
	if (found.length !== 1) {
		const types = jsonLdNodes(html).map((node) => JSON.stringify(node['@type']));
		throw new Error(`got ${found.length} JSON-LD ${type} nodes (types: ${types}), want 1`);
	}
	return found[0];
}

export type BreadcrumbItem = { position: number; name: string; item: string };

// A BreadcrumbList's items as { position, name, item }.
export function breadcrumbItems(list: JsonLdNode): BreadcrumbItem[] {
	const items = (list.itemListElement ?? []) as JsonLdNode[];
	return items.map((entry) => ({
		position: entry.position as number,
		name: entry.name as string,
		item: entry.item as string
	}));
}
