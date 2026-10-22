import type { components } from '#lib/api/schema.d.ts';
import { headLinks, type HeadLinks } from '#lib/i18n/head-links.ts';
import { recipeHref, regionHref, variationsHref } from '#lib/i18n/localized-href.ts';
import { locales, type Locale } from '#lib/i18n/locales.ts';
import { HOME_TABS, tabHref } from '#lib/ui/home-tab.ts';

// sitemaps.org 0.9 with Google's xhtml:link hreflang extension (stage FE-8).
// No lastmod: the API has no update time, only ETags.
const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8"?>';
const SITEMAP_NS = 'http://www.sitemaps.org/schemas/sitemap/0.9';
const XHTML_NS = 'http://www.w3.org/1999/xhtml';
export const SITEMAP_CONTENT_TYPE = 'application/xml; charset=utf-8';

export type SitemapCatalog = {
	regions: readonly { key: string }[];
	dishes: readonly components['schemas']['Dish'][];
};

const XML_ESCAPES: Record<string, string> = {
	'&': '&amp;',
	'<': '&lt;',
	'>': '&gt;',
	'"': '&quot;',
	"'": '&apos;'
};

const escapeXml = (value: string) => value.replace(/[&<>"']/g, (char) => XML_ESCAPES[char]);

// Every indexable page in `lang`: home (both tabs), each region, each dish's
// Variations page and each variation's Recipe page.
function pageHrefs({ regions, dishes }: SitemapCatalog, lang: Locale): string[] {
	return [
		...HOME_TABS.map((tab) => tabHref(tab, lang)),
		...regions.map((region) => regionHref(region.key, lang)),
		...dishes.map((dish) => variationsHref(dish.key, lang)),
		...dishes.flatMap((dish) =>
			dish.variations.map((variation) => recipeHref(dish.key, variation.regionKey, lang))
		)
	];
}

// <loc> and the alternates are the page head's own (headLinks), so the
// sitemap can't disagree with a page's canonical.
function urlElement({ canonical, alternates }: HeadLinks): string {
	const links = alternates.map(
		({ hreflang, href }) =>
			`<xhtml:link rel="alternate" hreflang="${escapeXml(hreflang)}" href="${escapeXml(href)}"/>`
	);
	return `<url><loc>${escapeXml(canonical)}</loc>${links.join('')}</url>`;
}

export function sitemapXml(origin: string, catalog: SitemapCatalog): string {
	const urls = locales
		.flatMap((lang) => pageHrefs(catalog, lang))
		.map((href) => urlElement(headLinks(origin, new URL(href, origin))));
	const urlset = `<urlset xmlns="${SITEMAP_NS}" xmlns:xhtml="${XHTML_NS}">`;
	return [XML_DECLARATION, urlset, ...urls, '</urlset>', ''].join('\n');
}
