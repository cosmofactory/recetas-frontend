import { catalog } from '#lib/server/catalog.ts';
import { orHttpError } from '#lib/server/load-errors.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => ({
	region: await orHttpError(catalog().getRegion(params.lang, params.regionKey))
});
