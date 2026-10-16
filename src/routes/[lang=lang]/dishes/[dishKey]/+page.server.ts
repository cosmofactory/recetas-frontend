import { catalog } from '#lib/server/catalog.ts';
import { orHttpError } from '#lib/server/load-errors.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => ({
	dish: await orHttpError(catalog().getDish(params.lang, params.dishKey))
});
