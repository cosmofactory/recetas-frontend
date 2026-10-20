import {
	context,
	propagation,
	SpanKind,
	SpanStatusCode,
	trace,
	type Span
} from '@opentelemetry/api';
import {
	ATTR_ERROR_TYPE,
	ATTR_HTTP_REQUEST_METHOD,
	ATTR_HTTP_RESPONSE_STATUS_CODE,
	ATTR_SERVER_ADDRESS,
	ATTR_SERVER_PORT,
	ATTR_URL_FULL
} from '@opentelemetry/semantic-conventions';
import type { Middleware } from 'openapi-fetch';
import { FIRST_CLIENT_ERROR, NOT_FOUND } from '#lib/http-status.ts';

// openapi-fetch middleware that makes every call to the Go API a CLIENT span
// under the active span (Kit's request/load span) and sends that span's W3C
// `traceparent`, so the Go server span (BE-1) joins the same trace. Spans are
// named by the OpenAPI path template, like the backend's route-pattern names.
// A 404 is expected traffic (an unknown key); any other 4xx is a request the
// contract rejects (a bug), and a 5xx or failed request an outage: errors.
// With telemetry disabled the tracer and propagator are no-ops.

const TRACER_NAME = 'recetas-frontend/api';
const DEFAULT_PORTS: Record<string, number> = { 'http:': 80, 'https:': 443 };

const headerSetter = {
	set: (headers: Headers, key: string, value: string) => headers.set(key, value)
};

export function tracingMiddleware(): Middleware {
	// openapi-fetch passes the Request onRequest returned to onResponse/onError.
	const spans = new WeakMap<Request, Span>();
	const tracer = trace.getTracer(TRACER_NAME);
	return {
		onRequest({ request, schemaPath }) {
			const span = tracer.startSpan(`${request.method} ${schemaPath}`, {
				kind: SpanKind.CLIENT,
				attributes: requestAttributes(request)
			});
			spans.set(request, span);
			propagation.inject(trace.setSpan(context.active(), span), request.headers, headerSetter);
			return request;
		},
		onResponse({ request, response }) {
			take(spans, request, (span) => endWithResponse(span, response));
			return response;
		},
		onError({ request, error }) {
			take(spans, request, (span) => endWithError(span, error));
		}
	};
}

function take(spans: WeakMap<Request, Span>, request: Request, end: (span: Span) => void): void {
	const span = spans.get(request);
	spans.delete(request);
	if (span) end(span);
}

function requestAttributes(request: Request) {
	const url = new URL(request.url);
	return {
		[ATTR_HTTP_REQUEST_METHOD]: request.method,
		[ATTR_URL_FULL]: url.href,
		[ATTR_SERVER_ADDRESS]: url.hostname,
		[ATTR_SERVER_PORT]: url.port ? Number(url.port) : DEFAULT_PORTS[url.protocol]
	};
}

function endWithResponse(span: Span, { status }: Response): void {
	span.setAttribute(ATTR_HTTP_RESPONSE_STATUS_CODE, status);
	if (isErrorStatus(status)) {
		span.setAttribute(ATTR_ERROR_TYPE, String(status));
		span.setStatus({ code: SpanStatusCode.ERROR });
	}
	span.end();
}

function isErrorStatus(status: number): boolean {
	return status >= FIRST_CLIENT_ERROR && status !== NOT_FOUND;
}

// A network error or timeout: no response at all.
function endWithError(span: Span, error: unknown): void {
	const err = error instanceof Error ? error : new Error(String(error));
	span.recordException(err);
	span.setAttribute(ATTR_ERROR_TYPE, err.name);
	span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
	span.end();
}
