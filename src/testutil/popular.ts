import type { Dish } from '#lib/server/catalog-source.ts';
import { buildView } from '#lib/server/mock/bundle-mapping.ts';
import bundle from '#lib/server/mock/content.bundle.json';
import type { PopularLocale } from './popular-copy';

// FE-5 fixtures for the Popular tab component specs: the dishes exactly as
// the [lang=lang] layout hands them on (variations already in region order,
// as the API documents), from the vendored mock bundle. Browser-safe.

export type { Dish };

// What DishCard takes (FE-5 PR 1 contract): data only. `href` is where the
// card leads (PR 1: ?tab=popular&dish=<key>, keeping the filters; PR 2 opens
// the dish sheet there); mediaBaseUrl is what <Photo> builds URLs against.
export type DishCardProps = {
	dish: Dish;
	href: string;
	mediaBaseUrl: string | undefined;
};

// What FilterBar takes (FE-5 PR 1 contract): the active ids (parseFilters of
// the URL) and two callbacks. onToggle(id) asks the screen to navigate to
// toggleFilterHref; onOpenFilters opens the Filters sheet (PR 2).
export type FilterBarProps = {
	active: readonly string[];
	onToggle: (id: string) => void;
	onOpenFilters: () => void;
};

export function dishesIn(lang: PopularLocale): Dish[] {
	return buildView(bundle, lang).dishes;
}

export function dishIn(lang: PopularLocale, key: string): Dish {
	const dish = dishesIn(lang).find((d) => d.key === key);
	if (!dish) throw new Error(`fixture has no dish ${key}`);
	return dish;
}

// Tortilla cut down to its first `count` variations (region order kept).
export function dishWithVariations(lang: PopularLocale, count: number): Dish {
	const tortilla = dishIn(lang, 'tortilla');
	return { ...tortilla, variations: tortilla.variations.slice(0, count) };
}

// Text as a reader sees it: collapsed whitespace, trimmed.
export const normalized = (text: string | null | undefined) =>
	(text ?? '').replace(/\s+/g, ' ').trim();
