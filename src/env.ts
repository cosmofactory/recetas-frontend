import { dev, building } from '$app/env';
import { defineEnvVars } from '@sveltejs/kit/env';

const DEV_ORIGIN = 'http://localhost:5173';

// "https://demo.asadorov.es" -> itself; a path, query or other scheme is a
// configuration error.
function parseOrigin(value: string): string {
	const url = URL.parse(value);
	if (!url || !/^https?:$/.test(url.protocol) || url.origin !== value.replace(/\/$/, '')) {
		throw new Error(`PUBLIC_ORIGIN must be a bare http(s) origin, got ${JSON.stringify(value)}`);
	}
	return url.origin;
}

export const variables = defineEnvVars({
	PUBLIC_ORIGIN: {
		description:
			'The public origin of the site, e.g. https://demo.asadorov.es. Canonical and hreflang URLs are built from it, never from the request Host header. Required outside `vite dev`.',
		schema: (value) => {
			if (value) return parseOrigin(value);
			if (dev || building) return DEV_ORIGIN;
			throw new Error('PUBLIC_ORIGIN is not set (e.g. PUBLIC_ORIGIN=https://demo.asadorov.es)');
		}
	}
});
