import { SpanKind, SpanStatusCode } from '@opentelemetry/api';
import type { ReadableSpan } from '@opentelemetry/sdk-trace-node';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { galicia, tortilla, type CatalogSource } from '../../testutil/catalog';
import {
	createFakeFetch,
	failNetwork,
	hangUntilAborted,
	inOrder,
	respondApiError,
	respondJson,
	type FetchHandler
} from '../../testutil/fake-fetch';
import { loadExport } from '../../testutil/load-export';
import {
	disableTracing,
	inActiveSpan,
	settled,
	startTestTracing,
	type TestTracing
} from '../../testutil/otel';

// FE-2 observability (stack.md B7): every call the API source makes to the Go
// API is a CLIENT span, a child of the active span (Kit's request/load span),
// and carries the W3C `traceparent` of that client span, so the Go server
// span (BE-1) joins the same trace. Spans are named by the OpenAPI path
// template, like the backend's route-pattern names, so `/v1/dishes/tortilla`
// and `/v1/dishes/cocido` group together. With telemetry disabled nothing is
// injected and requests behave as before.

type CreateApiSource = (options: {
	baseUrl: string;
	fetch: typeof globalThis.fetch;
	timeoutMs: number;
}) => CatalogSource;

const BASE_URL = 'http://backend:8080';
const TIMEOUT_MS = 20;
const TRACEPARENT = /^00-([0-9a-f]{32})-([0-9a-f]{16})-0[0-9a-f]$/;

async function sourceWith(handler: FetchHandler) {
	const create = await loadExport<CreateApiSource>(
		'src/lib/server/api-source.ts',
		'createApiSource'
	);
	const fake = createFakeFetch(handler);
	return {
		source: create({ baseUrl: BASE_URL, fetch: fake.fetch, timeoutMs: TIMEOUT_MS }),
		calls: fake.calls
	};
}

function clientSpans(tracing: TestTracing): ReadableSpan[] {
	return tracing.finishedSpans().filter((span) => span.kind === SpanKind.CLIENT);
}

function onlyClientSpan(tracing: TestTracing): ReadableSpan {
	const spans = clientSpans(tracing);
	expect(
		spans.map((s) => s.name),
		'got these client spans, want exactly one'
	).toHaveLength(1);
	return spans[0];
}

type Endpoint = {
	name: string;
	call: (s: CatalogSource) => Promise<unknown>;
	body: unknown;
	spanName: string;
	url: string;
};

const endpoints: Endpoint[] = [
	{
		name: 'listDishes',
		call: (s) => s.listDishes('en'),
		body: [tortilla],
		spanName: 'GET /v1/dishes',
		url: `${BASE_URL}/v1/dishes?lang=en`
	},
	{
		name: 'getDish',
		call: (s) => s.getDish('es', 'tortilla'),
		body: { ...tortilla, variations: [] },
		spanName: 'GET /v1/dishes/{dishKey}',
		url: `${BASE_URL}/v1/dishes/tortilla?lang=es`
	},
	{
		name: 'getRecipe',
		call: (s) => s.getRecipe('ru', { dishKey: 'tortilla', regionKey: 'gal' }),
		body: { dishKey: 'tortilla', regionKey: 'gal' },
		spanName: 'GET /v1/dishes/{dishKey}/variations/{regionKey}/recipe',
		url: `${BASE_URL}/v1/dishes/tortilla/variations/gal/recipe?lang=ru`
	}
];

describe('backend calls with telemetry enabled', () => {
	let tracing: TestTracing;
	beforeEach(() => {
		tracing = startTestTracing();
	});
	afterEach(() => tracing.shutdown());

	for (const ep of endpoints) {
		it(`${ep.name} sends a traceparent in the active span's trace`, async () => {
			const { source, calls } = await sourceWith(respondJson(200, ep.body));
			const { parent } = await inActiveSpan(() => ep.call(source));
			const traceparent = calls[0]?.headers.get('traceparent') ?? '';
			expect(traceparent, `got traceparent ${JSON.stringify(traceparent)}`).toMatch(TRACEPARENT);
			expect(TRACEPARENT.exec(traceparent)?.[1]).toBe(parent.traceId);
		});

		it(`${ep.name} records a CLIENT span "${ep.spanName}" under the active span`, async () => {
			const { source, calls } = await sourceWith(respondJson(200, ep.body));
			const { parent } = await inActiveSpan(() => ep.call(source));
			const span = onlyClientSpan(tracing);
			expect(span.name).toBe(ep.spanName);
			expect(span.spanContext().traceId).toBe(parent.traceId);
			expect(span.parentSpanContext?.spanId).toBe(parent.spanId);
			// The header names the client span itself, so the Go span is its child.
			const traceparent = calls[0]?.headers.get('traceparent') ?? '';
			expect(TRACEPARENT.exec(traceparent)?.[2]).toBe(span.spanContext().spanId);
		});

		it(`${ep.name} span carries the HTTP client semantic-convention attributes`, async () => {
			const { source } = await sourceWith(respondJson(200, ep.body));
			await inActiveSpan(() => ep.call(source));
			expect(onlyClientSpan(tracing).attributes).toMatchObject({
				'http.request.method': 'GET',
				'url.full': ep.url,
				'server.address': 'backend',
				'server.port': 8080,
				'http.response.status_code': 200
			});
		});
	}

	it('a 200 leaves the span status unset (not an error)', async () => {
		const { source } = await sourceWith(respondJson(200, [galicia]));
		await inActiveSpan(() => source.listRegions('en'));
		expect(onlyClientSpan(tracing).status.code).toBe(SpanStatusCode.UNSET);
	});

	for (const status of [500, 503]) {
		it(`an API ${status} ends the span with error status and the status code`, async () => {
			const { source } = await sourceWith(respondApiError(status, 'unavailable'));
			await inActiveSpan(() => settled(source.getDish('en', 'tortilla')));
			const span = onlyClientSpan(tracing);
			expect(span.status.code).toBe(SpanStatusCode.ERROR);
			expect(span.attributes['http.response.status_code']).toBe(status);
		});
	}

	it('a timeout ends the span with error status', async () => {
		const { source } = await sourceWith(hangUntilAborted);
		await inActiveSpan(() => settled(source.getDish('en', 'tortilla')));
		expect(onlyClientSpan(tracing).status.code).toBe(SpanStatusCode.ERROR);
	});

	// The one retry of a network error happens inside the call: one logical
	// request, one span, and the backend sees the same parent on both tries.
	it('a network error then a 200 is one CLIENT span whose traceparent both attempts carry', async () => {
		const { source, calls } = await sourceWith(
			inOrder(failNetwork(), respondJson(200, { ...tortilla, variations: [] }))
		);
		await inActiveSpan(() => source.getDish('en', 'tortilla'));
		const span = onlyClientSpan(tracing);
		expect(calls).toHaveLength(2);
		const spanIds = calls.map((c) => TRACEPARENT.exec(c.headers.get('traceparent') ?? '')?.[2]);
		expect(spanIds).toEqual([span.spanContext().spanId, span.spanContext().spanId]);
		expect(span.attributes['http.response.status_code']).toBe(200);
	});

	// An unknown key is expected traffic (the page renders its 404), not a
	// failed call.
	it('an API 404 leaves the span status unset and records 404', async () => {
		const { source } = await sourceWith(respondApiError(404, 'not_found'));
		await inActiveSpan(() => settled(source.getDish('en', 'no-such-dish')));
		const span = onlyClientSpan(tracing);
		expect(span.status.code).toBe(SpanStatusCode.UNSET);
		expect(span.attributes['http.response.status_code']).toBe(404);
	});

	// Any other 4xx means the frontend sent a request the contract rejects: a bug.
	it('an API 400 ends the span with error status', async () => {
		const { source } = await sourceWith(respondApiError(400, 'bad_request'));
		await inActiveSpan(() => settled(source.getDish('en', 'tortilla')));
		const span = onlyClientSpan(tracing);
		expect(span.status.code).toBe(SpanStatusCode.ERROR);
		expect(span.attributes['http.response.status_code']).toBe(400);
	});
});

describe('backend calls with telemetry disabled', () => {
	beforeEach(disableTracing);

	it('still return the body and send no traceparent', async () => {
		const { source, calls } = await sourceWith(respondJson(200, [tortilla]));
		await expect(source.listDishes('en')).resolves.toEqual([tortilla]);
		expect(calls[0]?.headers.has('traceparent')).toBe(false);
	});
});
