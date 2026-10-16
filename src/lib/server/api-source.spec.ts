import { describe, expect, it } from 'vitest';
import {
	galicia,
	galiciaDetail,
	tortilla,
	tortillaGalRecipe,
	type CatalogSource,
	type ErrorClass
} from '../../testutil/catalog';
import {
	createFakeFetch,
	failNetwork,
	hangUntilAborted,
	inOrder,
	respondApiError,
	respondJson,
	respondNotModified,
	type FetchHandler
} from '../../testutil/fake-fetch';
import { loadExport } from '../../testutil/load-export';

// FE-2: the typed API client behind CatalogSource. Paths and `lang` follow
// api/openapi.yaml; API 404 -> NotFoundError, 5xx/timeout/unreachable ->
// UnavailableError; one retry on a network error; lists are cached and
// revalidated with If-None-Match, nothing else sends it.

type ApiSourceOptions = {
	baseUrl: string;
	fetch: typeof globalThis.fetch;
	timeoutMs: number;
	listTtlMs?: number;
	now?: () => number;
};
type CreateApiSource = (options: ApiSourceOptions) => CatalogSource;

const BASE_URL = 'http://backend:8080';
const TIMEOUT_MS = 20;
const LIST_TTL_MS = 60_000;
const ETAG = 'W/"7-en"';

const errorClass = (name: string) => loadExport<ErrorClass>('src/lib/server/api-errors.ts', name);

async function sourceWith(handler: FetchHandler, extra: Partial<ApiSourceOptions> = {}) {
	const create = await loadExport<CreateApiSource>(
		'src/lib/server/api-source.ts',
		'createApiSource'
	);
	const fake = createFakeFetch(handler);
	const source = create({ baseUrl: BASE_URL, fetch: fake.fetch, timeoutMs: TIMEOUT_MS, ...extra });
	return { source, calls: fake.calls };
}

type Endpoint = {
	name: string;
	call: (s: CatalogSource) => Promise<unknown>;
	path: string;
	lang: string;
	body: unknown;
};

const listEndpoints: Endpoint[] = [
	{
		name: 'listRegions',
		call: (s) => s.listRegions('ru'),
		path: '/v1/regions',
		lang: 'ru',
		body: [galicia]
	},
	{
		name: 'listDishes',
		call: (s) => s.listDishes('en'),
		path: '/v1/dishes',
		lang: 'en',
		body: [tortilla]
	}
];

const detailEndpoints: Endpoint[] = [
	{
		name: 'getRegion',
		call: (s) => s.getRegion('es', 'gal'),
		path: '/v1/regions/gal',
		lang: 'es',
		body: galiciaDetail
	},
	{
		name: 'getDish',
		call: (s) => s.getDish('ru', 'tortilla'),
		path: '/v1/dishes/tortilla',
		lang: 'ru',
		body: tortilla
	},
	{
		name: 'getRecipe',
		call: (s) => s.getRecipe('en', { dishKey: 'tortilla', regionKey: 'gal' }),
		path: '/v1/dishes/tortilla/variations/gal/recipe',
		lang: 'en',
		body: tortillaGalRecipe
	}
];

const allEndpoints = [...listEndpoints, ...detailEndpoints];

describe('createApiSource requests', () => {
	for (const ep of allEndpoints) {
		it(`${ep.name} GETs ${ep.path}?lang=${ep.lang} and returns the body`, async () => {
			const { source, calls } = await sourceWith(respondJson(200, ep.body, { etag: ETAG }));
			const got = await ep.call(source);
			expect(got).toEqual(ep.body);
			expect(calls, `got ${calls.length} requests, want 1`).toHaveLength(1);
			const [req] = calls;
			expect(req.method).toBe('GET');
			expect(`${req.url.origin}${req.url.pathname}`).toBe(`${BASE_URL}${ep.path}`);
			expect(req.url.searchParams.get('lang'), 'got the wrong lang query').toBe(ep.lang);
		});

		it(`${ep.name} sends no If-None-Match on a first request`, async () => {
			const { source, calls } = await sourceWith(respondJson(200, ep.body, { etag: ETAG }));
			await ep.call(source);
			expect(calls[0].headers.get('if-none-match')).toBeNull();
		});
	}
});

describe('createApiSource error mapping', () => {
	for (const ep of detailEndpoints) {
		it(`${ep.name}: API 404 rejects with NotFoundError`, async () => {
			const NotFoundError = await errorClass('NotFoundError');
			const { source } = await sourceWith(respondApiError(404, 'not_found'));
			await expect(ep.call(source)).rejects.toBeInstanceOf(NotFoundError);
		});
	}

	for (const ep of allEndpoints) {
		for (const status of [500, 502, 503]) {
			it(`${ep.name}: API ${status} rejects with UnavailableError and is not retried`, async () => {
				const UnavailableError = await errorClass('UnavailableError');
				const { source, calls } = await sourceWith(respondApiError(status, 'internal'));
				await expect(ep.call(source)).rejects.toBeInstanceOf(UnavailableError);
				expect(calls, `got ${calls.length} requests, want 1`).toHaveLength(1);
			});
		}
	}
});

describe('createApiSource network failures', () => {
	for (const ep of allEndpoints) {
		it(`${ep.name}: retries a network error once, then succeeds`, async () => {
			const handler = inOrder(failNetwork(), respondJson(200, ep.body, { etag: ETAG }));
			const { source, calls } = await sourceWith(handler);
			await expect(ep.call(source)).resolves.toEqual(ep.body);
			expect(calls, `got ${calls.length} requests, want 2`).toHaveLength(2);
		});

		it(`${ep.name}: a second network error rejects with UnavailableError`, async () => {
			const UnavailableError = await errorClass('UnavailableError');
			const { source, calls } = await sourceWith(failNetwork());
			await expect(ep.call(source)).rejects.toBeInstanceOf(UnavailableError);
			expect(calls, `got ${calls.length} requests, want exactly 2 (one retry)`).toHaveLength(2);
		});

		it(`${ep.name}: a backend that never answers times out with UnavailableError, not retried`, async () => {
			const UnavailableError = await errorClass('UnavailableError');
			const { source, calls } = await sourceWith(hangUntilAborted);
			await expect(ep.call(source)).rejects.toBeInstanceOf(UnavailableError);
			expect(calls, `got ${calls.length} requests, want 1 (a timeout is not retried)`).toHaveLength(
				1
			);
		});

		it(`${ep.name}: a network error, then a retry that times out, rejects with UnavailableError`, async () => {
			const UnavailableError = await errorClass('UnavailableError');
			const { source, calls } = await sourceWith(inOrder(failNetwork(), hangUntilAborted));
			await expect(ep.call(source)).rejects.toBeInstanceOf(UnavailableError);
			expect(calls, `got ${calls.length} requests, want 2`).toHaveLength(2);
		});
	}
});

describe('createApiSource list cache', () => {
	function clock() {
		let t = 0;
		return { now: () => t, advance: (ms: number) => (t += ms) };
	}

	for (const ep of listEndpoints) {
		it(`${ep.name}: a repeat within the TTL is served from memory`, async () => {
			const c = clock();
			const handler = respondJson(200, ep.body, { etag: ETAG });
			const { source, calls } = await sourceWith(handler, { listTtlMs: LIST_TTL_MS, now: c.now });
			await ep.call(source);
			c.advance(LIST_TTL_MS - 1);
			await expect(ep.call(source)).resolves.toEqual(ep.body);
			expect(calls, `got ${calls.length} requests, want 1`).toHaveLength(1);
		});

		it(`${ep.name}: after the TTL it revalidates with If-None-Match and keeps the body on 304`, async () => {
			const c = clock();
			const handler = inOrder(respondJson(200, ep.body, { etag: ETAG }), respondNotModified(ETAG));
			const { source, calls } = await sourceWith(handler, { listTtlMs: LIST_TTL_MS, now: c.now });
			await ep.call(source);
			c.advance(LIST_TTL_MS + 1);
			await expect(ep.call(source)).resolves.toEqual(ep.body);
			expect(calls, `got ${calls.length} requests, want 2`).toHaveLength(2);
			expect(calls[1].headers.get('if-none-match')).toBe(ETAG);
		});
	}

	for (const ep of detailEndpoints) {
		it(`${ep.name}: never sends If-None-Match, even on a repeat`, async () => {
			const { source, calls } = await sourceWith(respondJson(200, ep.body, { etag: ETAG }));
			await ep.call(source);
			await ep.call(source);
			const sent = calls.map((c) => c.headers.get('if-none-match'));
			expect(sent, `got If-None-Match ${JSON.stringify(sent)}, want none`).toEqual(
				sent.map(() => null)
			);
		});
	}
});
