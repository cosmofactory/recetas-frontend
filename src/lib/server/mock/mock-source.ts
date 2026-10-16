import { locales } from '#lib/i18n/locales.ts';
import { NotFoundError } from '../api-errors.ts';
import type { CatalogSource, Lang } from '../catalog-source.ts';
import type { ContentBundle } from './bundle.ts';
import { buildView, recipePath, type CatalogView } from './bundle-mapping.ts';

// DATA_SOURCE=mock: the CatalogSource for local dev and tests, serving the
// vendored backend import bundle exactly as the API would. Every locale is
// mapped up front, so a malformed bundle fails at startup, not mid-request.

function find<T>(map: Map<string, T>, key: string, what: string): Promise<T> {
	const value = map.get(key);
	if (value === undefined) return Promise.reject(new NotFoundError(`no ${what} ${key}`));
	return Promise.resolve(value);
}

export function createMockSource(bundle: ContentBundle): CatalogSource {
	const views = new Map<Lang, CatalogView>(locales.map((lang) => [lang, buildView(bundle, lang)]));
	const view = (lang: Lang) => lookupView(views, lang);
	return {
		listRegions: async (lang) => view(lang).regions,
		listDishes: async (lang) => view(lang).dishes,
		getRegion: (lang, regionKey) => find(view(lang).regionDetails, regionKey, 'region'),
		getDish: (lang, dishKey) => find(view(lang).dishesByKey, dishKey, 'dish'),
		getRecipe: (lang, { dishKey, regionKey }) =>
			find(view(lang).recipes, recipePath(dishKey, regionKey), 'recipe')
	};
}

function lookupView(views: Map<Lang, CatalogView>, lang: Lang): CatalogView {
	const view = views.get(lang);
	if (!view) throw new Error(`unsupported locale ${lang}`);
	return view;
}
