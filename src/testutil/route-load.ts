import { vi } from 'vitest';
import type { CatalogSource } from '#lib/server/catalog-source.ts';
import bundle from '#lib/server/mock/content.bundle.json';
import { loadExport } from './load-export';

// Runs a route's +page.server.ts `load` against the mock catalog (FE-11
// loader specs). After vi.resetModules the route gets a fresh
// #lib/server/api-errors.ts, so the mock source is created from the same
// fresh modules: its NotFoundError is the class orHttpError knows. Call
// `unmockCatalog` in afterEach.

export type LoadEvent = { params: Record<string, string>; locals: object; url: URL };
type Load = (event: LoadEvent) => unknown;

// What a load did: returned data, or threw Kit's redirect() / error().
export type LoadOutcome =
	| { kind: 'data'; data: unknown }
	| { kind: 'redirect'; status: number; location: string }
	| { kind: 'error'; status: number }
	| { kind: 'thrown'; error: unknown };

type CatalogOverride = (source: CatalogSource) => CatalogSource;

const ORIGIN = 'http://localhost';

async function freshMockSource(override: CatalogOverride): Promise<CatalogSource> {
	const { createMockSource } = await import('#lib/server/mock/mock-source.ts');
	return override(createMockSource(bundle));
}

export async function loadRoute(pageServerFile: string, override: CatalogOverride = (s) => s) {
	vi.resetModules();
	const source = await freshMockSource(override);
	vi.doMock('#lib/server/catalog.ts', () => ({ catalog: () => source }));
	return loadExport<Load>(pageServerFile, 'load');
}

export function unmockCatalog() {
	vi.doUnmock('#lib/server/catalog.ts');
}

export function loadEvent(path: string, params: Record<string, string>): LoadEvent {
	return { params, locals: {}, url: new URL(path, ORIGIN) };
}

// Kit's Redirect and HttpError, told apart by shape: the route's
// @sveltejs/kit is a fresh copy, not the class this file would import.
function classify(err: unknown): LoadOutcome {
	const e = err as { status?: unknown; location?: unknown; body?: unknown } | undefined;
	if (typeof e?.status !== 'number') return { kind: 'thrown', error: err };
	if (typeof e.location === 'string') {
		return { kind: 'redirect', status: e.status, location: e.location };
	}
	if (e.body !== undefined) return { kind: 'error', status: e.status };
	return { kind: 'thrown', error: err };
}

export async function outcomeOf(load: Load, event: LoadEvent): Promise<LoadOutcome> {
	try {
		return { kind: 'data', data: await load(event) };
	} catch (err) {
		return classify(err);
	}
}

export const showOutcome = (outcome: LoadOutcome) =>
	JSON.stringify(outcome, (_key, value) => (value instanceof Error ? String(value) : value));
