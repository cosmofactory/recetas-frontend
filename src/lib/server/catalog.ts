import { BACKEND_API_BASE_URL, DATA_SOURCE } from '$app/env/private';
import { createApiSource } from './api-source.ts';
import type { CatalogSource } from './catalog-source.ts';
import bundle from './mock/content.bundle.json';
import { createMockSource } from './mock/mock-source.ts';

// The one CatalogSource of this server process, created on first use, so
// every request shares the list cache. Loaders call it through orHttpError.

// Short enough that a stuck backend gives a quick 503, far above the API's
// normal latency on the internal network.
const API_TIMEOUT_MS = 3_000;

let instance: CatalogSource | undefined;

export function catalog(): CatalogSource {
	instance ??= createCatalog();
	return instance;
}

function createCatalog(): CatalogSource {
	if (DATA_SOURCE === 'mock') return createMockSource(bundle);
	// src/env.ts refuses to start without it; only a build can get here.
	if (!BACKEND_API_BASE_URL) throw new Error('BACKEND_API_BASE_URL is not set');
	return createApiSource({
		baseUrl: BACKEND_API_BASE_URL,
		fetch: globalThis.fetch,
		timeoutMs: API_TIMEOUT_MS
	});
}
