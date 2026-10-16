import { dev, building } from '$app/env';
import { defineEnvVars } from '@sveltejs/kit/env';
import { selectSource } from '#lib/server/data-source.ts';

const DEV_ORIGIN = 'http://localhost:5173';
// Where `make -C ../recetas-backend docker-up` serves the API.
const DEV_BACKEND_URL = 'http://localhost:8080';

// "https://demo.asadorov.es" -> itself; a path, query or other scheme is a
// configuration error.
function parseOrigin(name: string, value: string): string {
	const url = URL.parse(value);
	if (!url || !/^https?:$/.test(url.protocol) || url.origin !== value.replace(/\/$/, '')) {
		throw new Error(`${name} must be a bare http(s) origin, got ${JSON.stringify(value)}`);
	}
	return url.origin;
}

// The API is only needed when the catalog comes from it. A schema can't see
// another variable's parsed value, so this reads the raw DATA_SOURCE.
function backendRequired(): boolean {
	return !building && selectSource(process.env) === 'api';
}

export const variables = defineEnvVars({
	PUBLIC_ORIGIN: {
		description:
			'The public origin of the site, e.g. https://demo.asadorov.es. Canonical and hreflang URLs are built from it, never from the request Host header. Required outside `vite dev`.',
		schema: (value) => {
			if (value) return parseOrigin('PUBLIC_ORIGIN', value);
			if (dev || building) return DEV_ORIGIN;
			throw new Error('PUBLIC_ORIGIN is not set (e.g. PUBLIC_ORIGIN=https://demo.asadorov.es)');
		}
	},
	DATA_SOURCE: {
		description:
			'Where the catalog comes from: `api` (default, the Go API at BACKEND_API_BASE_URL) or `mock` (the vendored content bundle; local dev and tests only).',
		schema: (value) => selectSource({ DATA_SOURCE: value })
	},
	BACKEND_API_BASE_URL: {
		description:
			'Internal origin of the Go API, e.g. http://backend:8080 (stack.md X4); never exposed to the browser. Required when DATA_SOURCE=api, outside `vite dev`.',
		schema: (value) => {
			if (value) return parseOrigin('BACKEND_API_BASE_URL', value);
			if (!backendRequired()) return undefined;
			if (dev) return DEV_BACKEND_URL;
			throw new Error(
				'BACKEND_API_BASE_URL is not set (e.g. BACKEND_API_BASE_URL=http://backend:8080)'
			);
		}
	}
});
