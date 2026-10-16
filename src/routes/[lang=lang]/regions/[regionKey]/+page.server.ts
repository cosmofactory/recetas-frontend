import { catalog } from '#lib/server/catalog.ts';
import { orHttpError } from '#lib/server/load-errors.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => ({
	region: await orHttpError(catalog().getRegion(event.params.lang, event.params.regionKey), event)
});
