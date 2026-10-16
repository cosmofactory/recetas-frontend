import createClient from 'openapi-fetch';
import type { paths } from '#lib/api/schema.d.ts';
import { NotFoundError, UnavailableError } from './api-errors.ts';
import { createListCache, type ListFetchResult } from './catalog-cache.ts';
import type { CatalogSource, Lang } from './catalog-source.ts';
import { FIRST_SERVER_ERROR, NOT_FOUND, NOT_MODIFIED, OK } from '#lib/http-status.ts';
import { resilientFetch } from './resilient-fetch.ts';

// The CatalogSource backed by the Go API (api/openapi.yaml), reached over the
// internal network (stack.md X4). The /v1/regions and /v1/dishes lists go
// through the per-locale list cache; detail calls always hit the API.

export const DEFAULT_LIST_TTL_MS = 60_000;

export type ApiSourceOptions = {
	baseUrl: string;
	fetch: typeof globalThis.fetch;
	timeoutMs: number;
	listTtlMs?: number;
	now?: () => number;
};

type Client = ReturnType<typeof createClient<paths>>;
type ApiResult<T> = { data?: T; response: Response };

export function createApiSource(options: ApiSourceOptions): CatalogSource {
	const client = createClient<paths>({
		baseUrl: options.baseUrl,
		fetch: resilientFetch(options.fetch, options.timeoutMs)
	});
	const cache = { ttlMs: options.listTtlMs ?? DEFAULT_LIST_TTL_MS, now: options.now ?? Date.now };
	const regions = createListCache({ fetchList: listRegions(client), ...cache });
	const dishes = createListCache({ fetchList: listDishes(client), ...cache });
	return {
		listRegions: (lang) => regions.get(lang),
		listDishes: (lang) => dishes.get(lang),
		getRegion: (lang, regionKey) =>
			one(
				client.GET('/v1/regions/{regionKey}', { params: { path: { regionKey }, query: { lang } } })
			),
		getDish: (lang, dishKey) =>
			one(client.GET('/v1/dishes/{dishKey}', { params: { path: { dishKey }, query: { lang } } })),
		getRecipe: (lang, path) =>
			one(
				client.GET('/v1/dishes/{dishKey}/variations/{regionKey}/recipe', {
					params: { path, query: { lang } }
				})
			)
	};
}

function listRegions(client: Client) {
	return (lang: Lang, etag?: string) =>
		list(client.GET('/v1/regions', { params: { query: { lang } }, headers: validator(etag) }));
}

function listDishes(client: Client) {
	return (lang: Lang, etag?: string) =>
		list(client.GET('/v1/dishes', { params: { query: { lang } }, headers: validator(etag) }));
}

function validator(etag?: string): Record<string, string> {
	return etag ? { 'if-none-match': etag } : {};
}

async function one<T>(pending: Promise<ApiResult<T>>): Promise<T> {
	const { data, response } = await settle(pending);
	if (response.ok && data !== undefined) return data;
	throw failure(response);
}

async function list<T>(pending: Promise<ApiResult<T>>): Promise<ListFetchResult<T>> {
	const { data, response } = await settle(pending);
	if (response.status === NOT_MODIFIED) return { status: NOT_MODIFIED };
	if (response.ok && data !== undefined) {
		return { status: OK, body: data, etag: response.headers.get('etag') ?? undefined };
	}
	throw failure(response);
}

async function settle<T>(pending: Promise<ApiResult<T>>): Promise<ApiResult<T>> {
	try {
		return await pending;
	} catch (err) {
		throw new UnavailableError('backend unreachable', { cause: err });
	}
}

function failure({ status, url }: Response): Error {
	const message = `backend answered ${status} for ${url}`;
	if (status === NOT_FOUND) return new NotFoundError(message);
	if (status >= FIRST_SERVER_ERROR) return new UnavailableError(message);
	return new Error(message);
}
