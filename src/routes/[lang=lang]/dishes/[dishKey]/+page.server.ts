import { redirect } from '@sveltejs/kit';
import { MOVED_PERMANENTLY } from '#lib/http-status.ts';
import { hasVariationsPage } from '#lib/content/dish-variations.ts';
import { dishHref } from '#lib/i18n/localized-href.ts';
import { catalog } from '#lib/server/catalog.ts';
import { orHttpError } from '#lib/server/load-errors.ts';
import type { PageServerLoad } from './$types';

// A dish with exactly one variation has no Variations page: its URL moves
// permanently to that recipe (both READMEs -> routes, FE-11).
export const load: PageServerLoad = async (event) => {
	const { lang, dishKey } = event.params;
	const dish = await orHttpError(catalog().getDish(lang, dishKey), event);
	if (!hasVariationsPage(dish)) redirect(MOVED_PERMANENTLY, dishHref(dish, lang));
	return { dish };
};
