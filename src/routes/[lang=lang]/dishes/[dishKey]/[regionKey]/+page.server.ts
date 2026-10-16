import { catalog } from '#lib/server/catalog.ts';
import { orHttpError } from '#lib/server/load-errors.ts';
import type { PageServerLoad } from './$types';

// The recipe body carries the dish, region and variation names too, so this
// page needs no other call.
export const load: PageServerLoad = async ({ params }) => ({
	recipe: await orHttpError(
		catalog().getRecipe(params.lang, { dishKey: params.dishKey, regionKey: params.regionKey })
	)
});
