import { PUBLIC_ORIGIN } from '$app/env/private';
import type { LayoutServerLoad } from './$types';

// PUBLIC_ORIGIN, never the request Host: the base of canonical, hreflang and
// og:image URLs. Loaded at the root so error pages outside a locale (/fr/)
// get it too.
export const load: LayoutServerLoad = () => ({ origin: PUBLIC_ORIGIN });
