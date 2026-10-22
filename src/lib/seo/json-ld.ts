export const SCHEMA_ORG_CONTEXT = 'https://schema.org';

export type JsonLdNode = Record<string, unknown>;

// The text of a <script type="application/ld+json">. Script text is raw (no
// entity decoding), so instead of HTML-escaping, every "<" becomes the JSON
// escape `\u003c`: no content can close the script or open a comment, and the
// text still parses to the same value.
export function serializeJsonLd(data: unknown): string {
	return JSON.stringify(data).replaceAll('<', '\\u003c');
}

// The whole <script> element, for {@html} in a page head (JsonLd.svelte).
export const jsonLdScriptTag = (data: unknown): string =>
	`<script type="application/ld+json">${serializeJsonLd(data)}</script>`;
