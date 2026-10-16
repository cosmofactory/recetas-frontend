import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import v8 from 'node:v8';
import vm from 'node:vm';
import { afterEach, describe, expect, it } from 'vitest';
import type { CatalogSource, ErrorClass } from '../../testutil/catalog';
import { loadExport } from '../../testutil/load-export';

// Regression: a request timeout must fire even when garbage collection runs
// while the request waits. undici's Request only follows an outer abort
// signal through a WeakRef, so a timeout signal that nothing else holds can
// be collected and the request then hangs forever. This uses the real Node
// fetch against a local server that accepts connections but never answers.

type CreateApiSource = (options: {
	baseUrl: string;
	fetch: typeof globalThis.fetch;
	timeoutMs: number;
}) => CatalogSource;
type CheckBackendReady = (options: {
	baseUrl: string;
	timeoutMs: number;
	fetch?: typeof globalThis.fetch;
}) => Promise<boolean>;
type Outcome = { state: 'resolved'; value: unknown } | { state: 'rejected'; error: unknown };

// Long enough that a one-off stall of the test process before the request is
// written can't fire the timeout first (no request at the backend), and still
// far below the deadline.
const TIMEOUT_MS = 400;
// Generous for CI; a collected timeout signal never settles at all.
const DEADLINE_MS = 1_500;
const GC_EVERY_MS = 5;

v8.setFlagsFromString('--expose-gc');
const gc = vm.runInNewContext('gc') as () => void;

let server: Server | undefined;

afterEach(async () => {
	server?.closeAllConnections();
	await new Promise((resolve) => server?.close(resolve) ?? resolve(undefined));
	server = undefined;
});

// Accepts every request and never answers it.
async function silentBackend() {
	const received: string[] = [];
	server = createServer((req) => received.push(req.url ?? ''));
	await new Promise<void>((resolve) => server?.listen(0, '127.0.0.1', resolve));
	const { port } = server.address() as AddressInfo;
	return { baseUrl: `http://127.0.0.1:${port}`, received };
}

function settle(pending: Promise<unknown>): Promise<Outcome> {
	return pending.then(
		(value) => ({ state: 'resolved' as const, value }),
		(error: unknown) => ({ state: 'rejected' as const, error })
	);
}

// How `pending` settles, collecting garbage every few ms meanwhile; null when
// it hasn't settled by the deadline.
async function settleUnderGc(pending: Promise<unknown>): Promise<Outcome | null> {
	const collector = setInterval(gc, GC_EVERY_MS);
	const deadline = delay(DEADLINE_MS, null);
	try {
		return await Promise.race([settle(pending), deadline]);
	} finally {
		clearInterval(collector);
	}
}

describe('request timeouts survive garbage collection', () => {
	it(`api source: a silent backend rejects with UnavailableError within ${DEADLINE_MS} ms`, async () => {
		const [createApiSource, UnavailableError] = await Promise.all([
			loadExport<CreateApiSource>('src/lib/server/api-source.ts', 'createApiSource'),
			loadExport<ErrorClass>('src/lib/server/api-errors.ts', 'UnavailableError')
		]);
		const { baseUrl, received } = await silentBackend();
		const source = createApiSource({ baseUrl, fetch: globalThis.fetch, timeoutMs: TIMEOUT_MS });
		const outcome = await settleUnderGc(source.getDish('en', 'tortilla'));
		expect(outcome?.state, `got ${outcome?.state ?? 'no answer'}, want rejected`).toBe('rejected');
		expect(outcome?.state === 'rejected' && outcome.error).toBeInstanceOf(UnavailableError);
		expect(received, 'got no request at the backend').toContain('/v1/dishes/tortilla?lang=en');
	});

	it(`readiness: a silent backend is not ready within ${DEADLINE_MS} ms (global fetch)`, async () => {
		const checkBackendReady = await loadExport<CheckBackendReady>(
			'src/lib/server/readiness.ts',
			'checkBackendReady'
		);
		const { baseUrl, received } = await silentBackend();
		const outcome = await settleUnderGc(checkBackendReady({ baseUrl, timeoutMs: TIMEOUT_MS }));
		expect(outcome, `got ${JSON.stringify(outcome) ?? 'no answer'}, want not ready`).toEqual({
			state: 'resolved',
			value: false
		});
		expect(received, 'got no request at the backend').toEqual(['/healthz']);
	});
});
