import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	createFakeFetch,
	failNetwork,
	hangUntilAborted,
	respondJson,
	type FetchHandler
} from '../../testutil/fake-fetch';
import { loadExport } from '../../testutil/load-export';

// FE-2 /readyz: the backend is ready when its /healthz answers 200 within the
// timeout. Every other outcome is "not ready"; the check never throws. It uses
// the global fetch unless one is injected: SvelteKit's event.fetch re-wraps
// the request, which can lose the timeout signal (timeout-under-gc.spec.ts).

type CheckBackendReady = (options: {
	baseUrl: string;
	timeoutMs: number;
	fetch?: typeof globalThis.fetch;
}) => Promise<boolean>;

const TIMEOUT_MS = 20;

const load = () =>
	loadExport<CheckBackendReady>('src/lib/server/readiness.ts', 'checkBackendReady');

afterEach(() => vi.unstubAllGlobals());

async function check(handler: FetchHandler, baseUrl = 'http://backend:8080') {
	const checkBackendReady = await load();
	const fake = createFakeFetch(handler);
	const ready = await checkBackendReady({ baseUrl, fetch: fake.fetch, timeoutMs: TIMEOUT_MS });
	return { ready, calls: fake.calls };
}

describe('checkBackendReady', () => {
	for (const baseUrl of ['http://backend:8080', 'http://backend:8080/']) {
		it(`GETs /healthz on ${baseUrl}`, async () => {
			const { calls } = await check(respondJson(200, { status: 'ok' }), baseUrl);
			expect(calls).toHaveLength(1);
			expect(calls[0].method).toBe('GET');
			expect(calls[0].url.href).toBe('http://backend:8080/healthz');
		});
	}

	it('is ready when the backend answers 200', async () => {
		const { ready } = await check(respondJson(200, { status: 'ok' }));
		expect(ready).toBe(true);
	});

	const notReady: { name: string; handler: FetchHandler }[] = [
		{ name: 'a 503 (database down)', handler: respondJson(503, { status: 'degraded' }) },
		{ name: 'a 500', handler: respondJson(500, {}) },
		{ name: 'a 404', handler: respondJson(404, {}) },
		{ name: 'a network error', handler: failNetwork() },
		{ name: 'no answer within the timeout', handler: hangUntilAborted }
	];
	for (const { name, handler } of notReady) {
		it(`is not ready (and does not throw) on ${name}`, async () => {
			const { ready } = await check(handler);
			expect(ready, `got ready=${ready}, want false`).toBe(false);
		});
	}

	it('uses the global fetch when none is injected', async () => {
		const checkBackendReady = await load();
		const fake = createFakeFetch(respondJson(200, { status: 'ok' }));
		vi.stubGlobal('fetch', fake.fetch);
		const ready = await checkBackendReady({
			baseUrl: 'http://backend:8080',
			timeoutMs: TIMEOUT_MS
		});
		expect(ready).toBe(true);
		expect(fake.calls.map((c) => c.url.href)).toEqual(['http://backend:8080/healthz']);
	});
});
