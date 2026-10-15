import { PUBLIC_ORIGIN } from '$app/env/private';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = () => ({ origin: PUBLIC_ORIGIN });
