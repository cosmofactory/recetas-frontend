import type { components } from '#lib/api/schema.d.ts';
import { DOT_SEPARATOR } from '#lib/i18n/format.ts';
import type { Locale } from '#lib/i18n/locales.ts';
import { m } from '#lib/paraglide/messages.js';
import { normalize } from './normalize.ts';

type Schemas = components['schemas'];
type Dish = Pick<Schemas['Dish'], 'key' | 'name' | 'nameEs' | 'variations'>;
type Variation = Dish['variations'][number];
type Region = Pick<Schemas['Region'], 'key' | 'name' | 'nameEs' | 'regionalDishes'> & {
	tileColor: string | null;
};
export type SearchCatalog = { regions: Region[]; dishes: Dish[] };

// Both READMEs -> Overlay — Search: the result groups, in display order.
export const SEARCH_GROUPS = ['dish', 'variation', 'region'] as const;
export type SearchGroupKey = (typeof SEARCH_GROUPS)[number];

export type SearchEntry = {
	group: SearchGroupKey;
	title: string;
	subtitle: string;
	dishKey?: string;
	regionKey?: string;
	tileColor?: string | null;
	// Normalised title, subtitle and the other matched texts (normalize.ts).
	haystack: string;
};

// Mobile prototype: the regional dishes as one line.
const REGIONAL_DISH_SEPARATOR = ', ';
// Joins the haystack's texts so a query can't match across two of them.
const HAYSTACK_SEPARATOR = '\n';

const haystack = (texts: string[]) => texts.map(normalize).join(HAYSTACK_SEPARATOR);

// Entries in group order, each group in catalog order (stage FE-7: search
// keeps that order and never ranks).
export function buildIndex({ regions, dishes }: SearchCatalog, locale: Locale): SearchEntry[] {
	return [
		...dishes.map((dish) => dishEntry(dish, locale)),
		...dishes.flatMap((dish) =>
			dish.variations.map((variation) => variationEntry(dish, variation))
		),
		...regions.map(regionEntry)
	];
}

// Stage FE-7 -> Small decisions: a dish also matches on its variations'
// names, local and Spanish, as in the prototype ("paella" in ru).
function dishEntry(dish: Dish, locale: Locale): SearchEntry {
	const title = dish.name;
	const subtitle = m.home_variation({ count: dish.variations.length }, { locale });
	const variationNames = dish.variations.flatMap((variation) => [variation.name, variation.nameEs]);
	return {
		group: 'dish',
		title,
		subtitle,
		dishKey: dish.key,
		haystack: haystack([title, subtitle, dish.nameEs, ...variationNames])
	};
}

function variationEntry(dish: Dish, variation: Variation): SearchEntry {
	const title = variation.name;
	const subtitle = [variation.regionName, dish.name].join(DOT_SEPARATOR);
	return {
		group: 'variation',
		title,
		subtitle,
		dishKey: dish.key,
		regionKey: variation.regionKey,
		haystack: haystack([title, subtitle, variation.nameEs, variation.description])
	};
}

function regionEntry(region: Region): SearchEntry {
	const title = region.name;
	const subtitle = region.regionalDishes.join(REGIONAL_DISH_SEPARATOR);
	return {
		group: 'region',
		title,
		subtitle,
		regionKey: region.key,
		tileColor: region.tileColor,
		haystack: haystack([title, subtitle, region.nameEs])
	};
}
