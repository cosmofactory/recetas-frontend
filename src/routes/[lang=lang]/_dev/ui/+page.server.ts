import { error } from '@sveltejs/kit';
import { dev } from '$app/env';
import { NOT_FOUND } from '#lib/http-status.ts';
import type { PageServerLoad } from './$types';

// FE-3: the UI primitive gallery is for side-by-side checks against the
// prototypes under `vite dev` only; any other build answers 404.
export const load: PageServerLoad = () => {
	if (!dev) error(NOT_FOUND);
};
