import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	createFakeFetch,
	failNetwork,
	respondJson,
	type FetchHandler
} from '../../testutil/fake-fetch';
import { loadExport } from '../../testutil/load-export';

// FE-2: GET /readyz is 200 when the backend's /healthz is, 503 otherwise. It
// is what INF-2 smoke tests and INF-3 uptime checks hit, since the API is
// internal (X4). The body never carries error detail, and it is never cached.
// The check goes through the global fetch, not event.fetch, whose re-wrapped
// request can lose the timeout signal (timeout-under-gc.spec.ts); the tests
// stub the global and fail if event.fetch is used.

vi.mock('$app/env/private', () => ({
	BACKEND_API_BASE_URL: 'http://backend:8080',
	PUBLIC_ORIGIN: 'http://127.0.0.1:4173'
}));

type Get = (event: { fetch: typeof globalThis.fetch }) => Promise<Response>;

const DETAIL = 'connect ECONNREFUSED 10.1.2.3:8080';

afterEach(() => vi.unstubAllGlobals());

async function readyz(handler: FetchHandler) {
	const GET = await loadExport<Get>('src/routes/readyz/+server.ts', 'GET');
	const backend = createFakeFetch(handler);
	vi.stubGlobal('fetch', backend.fetch);
	const eventFetch = createFakeFetch(handler);
	const res = await GET({ fetch: eventFetch.fetch });
	expect(eventFetch.calls, 'got a call through event.fetch, want the global fetch').toEqual([]);
	return { res, body: await res.text(), calls: backend.calls };
}

describe('GET /readyz', () => {
	it('checks the backend /healthz over BACKEND_API_BASE_URL', async () => {
		const { calls } = await readyz(respondJson(200, { status: 'ok' }));
		expect(calls.map((c) => c.url.href)).toEqual(['http://backend:8080/healthz']);
	});

	it('returns 200 when the backend is healthy, and is never cached', async () => {
		const { res } = await readyz(respondJson(200, { status: 'ok' }));
		expect(res.status, `got ${res.status}, want 200`).toBe(200);
		expect(res.headers.get('cache-control')).toBe('no-store');
	});

	const down: { name: string; handler: FetchHandler; secrets: string[] }[] = [
		{
			name: 'the backend reports a degraded database',
			handler: respondJson(503, { status: 'degraded', checks: { database: 'timeout' } }),
			secrets: ['degraded', 'database', 'timeout']
		},
		{
			name: 'the backend is unreachable',
			handler: failNetwork(DETAIL),
			secrets: ['ECONNREFUSED', '10.1.2.3', 'fetch failed', 'backend:8080']
		}
	];
	for (const { name, handler, secrets } of down) {
		it(`returns 503 without error detail when ${name}`, async () => {
			const { res, body } = await readyz(handler);
			expect(res.status, `got ${res.status}, want 503`).toBe(503);
			expect(res.headers.get('cache-control')).toBe('no-store');
			for (const secret of secrets) {
				expect(body, `got body ${body}, want no "${secret}"`).not.toContain(secret);
			}
		});
	}
});
