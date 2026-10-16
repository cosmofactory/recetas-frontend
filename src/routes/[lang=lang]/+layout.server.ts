import { PUBLIC_ORIGIN } from '$app/env/private';
import { catalog } from '#lib/server/catalog.ts';
import { orHttpError } from '#lib/server/load-errors.ts';
import type { LayoutServerLoad } from './$types';

// The whole catalog for the page's locale (stack.md X1): search, filters and
// the home screens work over these two lists.
export const load: LayoutServerLoad = async ({ params }) => {
	const [regions, dishes] = await orHttpError(
		Promise.all([catalog().listRegions(params.lang), catalog().listDishes(params.lang)])
	);
	return { origin: PUBLIC_ORIGIN, regions, dishes };
};
