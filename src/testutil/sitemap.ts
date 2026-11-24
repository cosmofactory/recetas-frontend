import { childrenNamed, parseXml, type XmlDocument } from './xml';

// The /sitemap.xml contract (FE-8 PR 2), shared by the route spec and the
// Playwright spec. sitemaps.org 0.9 with Google's hreflang extension: a
// <urlset> in the sitemap namespace declaring xmlns:xhtml, one <url> per
// page per locale whose children follow the XSD's order (loc, then the
// optional lastmod/changefreq/priority, then elements from other
// namespaces: the xhtml:link alternates).

export const SITEMAP_NS = 'http://www.sitemaps.org/schemas/sitemap/0.9';
export const XHTML_NS = 'http://www.w3.org/1999/xhtml';
export const SITEMAP_PATH = '/sitemap.xml';

// The mock bundle (content.bundle.json): 17 regions, 9 dishes, 57
// variations; home and home Popular, every region, every dish with a
// Variations page (FE-11: 8; Arroz blanco has one variation, so its dish URL
// 301s to its recipe and is left out) and every variation (its Recipe page,
// /esp/:variationSlug for the 3 Spanish ones), in en, es and ru.
export const MOCK_SITEMAP_URL_COUNT = (2 + 17 + 8 + 57) * 3;

export type Alternate = { hreflang: string; href: string };

export type SitemapEntry = {
	loc: string;
	childNames: string[];
	alternates: Alternate[];
	// Each xhtml:link's rel, in order.
	linkRels: string[];
};

const byHreflang = (a: Alternate, b: Alternate) => a.hreflang.localeCompare(b.hreflang);
export const sortedAlternates = (alternates: Alternate[]) => [...alternates].sort(byHreflang);

export function parseSitemap(xml: string): XmlDocument & { entries: SitemapEntry[] } {
	const doc = parseXml(xml);
	const entries = childrenNamed(doc.root, 'url').map((url) => {
		const links = childrenNamed(url, 'xhtml:link');
		return {
			loc: childrenNamed(url, 'loc')[0]?.text.trim() ?? '',
			childNames: url.children.map((child) => child.name),
			alternates: links.map((l) => ({ hreflang: l.attrs.hreflang, href: l.attrs.href })),
			linkRels: links.map((l) => l.attrs.rel)
		};
	});
	return { ...doc, entries };
}
