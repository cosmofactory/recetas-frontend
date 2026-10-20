import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { captureLogLines } from './testutil/log-capture';
import { loadExport } from './testutil/load-export';
import { inActiveSpan, startTestTracing, type TestTracing } from './testutil/otel';

// FE-2 observability: Kit 3 calls the server `handleError` for every error
// (kind app / framework / validation / unknown). An unknown error is a bug:
// it is logged once as a JSON line linked to the trace (trace_id/span_id),
// with the error's message, cause chain and stack, the status and the route
// id, and the client gets only Kit's generic 500 body. App errors (our 404 and
// 503 from orHttpError, which logs the outage itself) and framework errors
// (an unknown URL) are not logged here.

type Caught = { kind: string; error: unknown; event: unknown };
type HandleError = (input: Caught) => unknown;

const ROUTE_ID = '/[lang=lang]/dishes/[dishKey]';
const STACK_FRAME = 'at load (src/routes/[lang=lang]/dishes/[dishKey]/+page.server.ts:12:7)';
// What Kit sends for an unknown error when the hook overrides nothing.
const GENERIC_BODY = { status: 500, message: 'Internal Error' };

const load = () => loadExport<HandleError>('src/hooks.server.ts', 'handleError');

function requestEvent(routeId: string | null) {
	return {
		route: { id: routeId },
		url: new URL('http://localhost/en/dishes/tortilla'),
		locals: {}
	};
}

function bug(): Error {
	const err = new TypeError("Cannot read properties of undefined (reading 'variations')", {
		cause: new Error('dish payload had no variations')
	});
	err.stack = `TypeError: ${err.message}\n    ${STACK_FRAME}`;
	return err;
}

// Kit merges the hook's result over its fallback body (errors.js `merge`).
async function bodyFrom(result: unknown) {
	return { ...GENERIC_BODY, ...((await result) as object | undefined) };
}

describe('handleError: unknown errors', () => {
	let tracing: TestTracing;
	beforeEach(() => {
		tracing = startTestTracing();
	});
	afterEach(async () => {
		vi.restoreAllMocks();
		await tracing.shutdown();
	});

	it('logs one ERROR line with the trace ids, status and route id', async () => {
		const handleError = await load();
		const out = captureLogLines();
		const { parent } = await inActiveSpan(async () =>
			handleError({ kind: 'unknown', error: bug(), event: requestEvent(ROUTE_ID) })
		);
		const lines = out.lines();
		expect(lines).toHaveLength(1);
		expect(lines[0]).toMatchObject({
			level: 'ERROR',
			trace_id: parent.traceId,
			span_id: parent.spanId,
			status: 500,
			route: ROUTE_ID
		});
	});

	it('the line carries the message, the cause chain and the stack', async () => {
		const handleError = await load();
		const out = captureLogLines();
		await inActiveSpan(async () =>
			handleError({ kind: 'unknown', error: bug(), event: requestEvent(ROUTE_ID) })
		);
		const raw = out.raw();
		for (const part of ["reading 'variations'", 'dish payload had no variations', STACK_FRAME]) {
			expect(raw, `got ${raw}, want it to contain ${part}`).toContain(
				JSON.stringify(part).slice(1, -1)
			);
		}
	});

	it('a thrown non-Error is still logged with its value', async () => {
		const handleError = await load();
		const out = captureLogLines();
		await handleError({ kind: 'unknown', error: 'plain string thrown', event: requestEvent(null) });
		expect(out.lines()).toHaveLength(1);
		expect(out.raw()).toContain('plain string thrown');
	});

	it('returns only the generic 500 body, never the detail', async () => {
		const handleError = await load();
		captureLogLines();
		const body = await bodyFrom(
			handleError({ kind: 'unknown', error: bug(), event: requestEvent(ROUTE_ID) })
		);
		expect(body).toEqual(GENERIC_BODY);
	});
});

describe('handleError: expected errors', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	const cases = [
		{
			name: 'an app 503 (orHttpError already logged it)',
			kind: 'app',
			error: { status: 503, message: 'Service Unavailable' }
		},
		{ name: 'an app 404 (unknown key)', kind: 'app', error: { status: 404, message: 'Not Found' } },
		{
			name: 'a framework 404 (unknown URL)',
			kind: 'framework',
			error: { status: 404, message: 'Not Found' }
		}
	];
	for (const { name, kind, error } of cases) {
		it(`does not log ${name} and keeps its body`, async () => {
			const handleError = await load();
			const out = captureLogLines();
			const result = (await handleError({ kind, error, event: requestEvent(ROUTE_ID) })) as
				object | undefined;
			expect(out.raw()).toBe('');
			expect({ ...error, ...result }).toEqual(error);
		});
	}
});
