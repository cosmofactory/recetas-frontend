import { SCHEMA_ORG_CONTEXT, type JsonLdNode } from './json-ld.ts';

// One entry of a BreadcrumbList or ItemList: a page's name and absolute URL.
export type LinkedPage = { name: string; url: string };

const listItem = (position: number, fields: JsonLdNode): JsonLdNode => ({
	'@type': 'ListItem',
	position,
	...fields
});

// schema.org BreadcrumbList: the trail to the page, the page itself last.
export function breadcrumbJsonLd(trail: readonly LinkedPage[]): JsonLdNode {
	return {
		'@context': SCHEMA_ORG_CONTEXT,
		'@type': 'BreadcrumbList',
		itemListElement: trail.map(({ name, url }, i) => listItem(i + 1, { name, item: url }))
	};
}

// schema.org ItemList of other pages, in the given order.
export function itemListJsonLd(pages: readonly LinkedPage[]): JsonLdNode {
	return {
		'@context': SCHEMA_ORG_CONTEXT,
		'@type': 'ItemList',
		itemListElement: pages.map(({ name, url }, i) => listItem(i + 1, { name, url }))
	};
}
