import { PUBLIC_ORIGIN } from '$app/env/private';
import { MEDIA_BASE_URL } from '$app/env/public';
import { catalog } from '#lib/server/catalog.ts';
import { orHttpError } from '#lib/server/load-errors.ts';
import type { LayoutServerLoad } from './$types';

// The whole catalog for the page's locale (stack.md X1): search, filters and
// the home screens work over these two lists. `mediaBaseUrl` is what <Photo>
// builds image URLs against (undefined: every photo is the placeholder).
export const load: LayoutServerLoad = async (event) => {
	const { lang } = event.params;
	const [regions, dishes] = await orHttpError(
		Promise.all([catalog().listRegions(lang), catalog().listDishes(lang)]),
		event
	);
	return { origin: PUBLIC_ORIGIN, mediaBaseUrl: MEDIA_BASE_URL, regions, dishes };
};
