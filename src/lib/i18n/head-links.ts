import { POPULAR, TAB_PARAM } from '#lib/ui/home-tab.ts';
import { baseLocale, locales } from './locales.ts';

export type HeadLinks = {
	canonical: string;
	alternates: { hreflang: string; href: string }[];
};

// The only indexable query param: the home page's Popular tab
// (/:lang/?tab=popular). Regional is the default and has no param.
const INDEXABLE_TABS: ReadonlySet<string> = new Set([POPULAR]);
const HOME_PATH = '/';

// URL, or SvelteKit's read-only page.url.
type PageUrl = { pathname: string; searchParams: Pick<URLSearchParams, 'get'> };

// "?tab=popular&utm=x" on the home page -> "?tab=popular"; anything else -> "".
function indexableQuery(rest: string, searchParams: PageUrl['searchParams']): string {
	const tab = searchParams.get(TAB_PARAM);
	if (rest !== HOME_PATH || tab === null || !INDEXABLE_TABS.has(tab)) return '';
	return `?${new URLSearchParams({ [TAB_PARAM]: tab })}`;
}

// Canonical and hreflang URLs for a localised page (stack.md F7). `origin` is
// PUBLIC_ORIGIN, never the request Host; `url.pathname` starts with /<lang>.
export function headLinks(origin: string, url: PageUrl): HeadLinks {
	const rest = url.pathname.replace(/^\/[^/]+/, '');
	const query = indexableQuery(rest, url.searchParams);
	const hrefFor = (locale: string) => `${origin}/${locale}${rest}${query}`;
	return {
		canonical: hrefFor(url.pathname.split('/')[1]),
		alternates: [
			...locales.map((locale) => ({ hreflang: locale, href: hrefFor(locale) })),
			{ hreflang: 'x-default', href: hrefFor(baseLocale) }
		]
	};
}
