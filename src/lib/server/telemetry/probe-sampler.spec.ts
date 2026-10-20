import {
	context,
	ROOT_CONTEXT,
	SpanKind,
	trace,
	TraceFlags,
	type Context
} from '@opentelemetry/api';
import { SamplingDecision } from '@opentelemetry/sdk-trace-node';
import { describe, expect, it } from 'vitest';
import { probeSkippingSampler } from './probe-sampler.ts';

// Health probes (Docker healthcheck, uptime checks) produce no traces; every
// other request does.

const TRACE_ID = '0af7651916cd43dd8448eb211c80319c';

function decisionFor(route: string): SamplingDecision {
	return probeSkippingSampler().shouldSample(
		context.active(),
		TRACE_ID,
		'sveltekit.handle.root',
		SpanKind.INTERNAL,
		{ 'http.route': route },
		[]
	).decision;
}

describe('probeSkippingSampler', () => {
	for (const route of ['/healthz', '/readyz']) {
		it(`drops the root span of ${route}`, () => {
			expect(decisionFor(route)).toBe(SamplingDecision.NOT_RECORD);
		});
	}

	for (const route of ['/[lang=lang]', '/[lang=lang]/dishes/[dishKey]', 'unknown']) {
		it(`samples the root span of ${route}`, () => {
			expect(decisionFor(route)).toBe(SamplingDecision.RECORD_AND_SAMPLED);
		});
	}
});

// Kit continues the trace of an incoming `traceparent` (its root span gets a
// remote parent). The frontend is the public edge, so a client's sampled flag
// must not decide what we record: a remote parent with flags 00 is still
// sampled, and probes are still dropped. A local parent (Kit's handle and load
// spans under the root) is followed, so a dropped probe drops its children.
const REMOTE_SPAN_ID = 'b7ad6b7169203331';

function parentContext(parent: { sampled: boolean; isRemote: boolean }): Context {
	return trace.setSpanContext(ROOT_CONTEXT, {
		traceId: TRACE_ID,
		spanId: REMOTE_SPAN_ID,
		traceFlags: parent.sampled ? TraceFlags.SAMPLED : TraceFlags.NONE,
		isRemote: parent.isRemote
	});
}

function decisionUnder(
	parent: { sampled: boolean; isRemote: boolean },
	route: string,
	kind: SpanKind
): SamplingDecision {
	return probeSkippingSampler().shouldSample(
		parentContext(parent),
		TRACE_ID,
		'sveltekit.handle.root',
		kind,
		{ 'http.route': route },
		[]
	).decision;
}

describe('probeSkippingSampler under an incoming traceparent', () => {
	for (const kind of [SpanKind.SERVER, SpanKind.INTERNAL]) {
		const kindName = SpanKind[kind];
		for (const sampled of [false, true]) {
			it(`samples a ${kindName} root of /[lang=lang] whose remote parent has sampled=${sampled}`, () => {
				const decision = decisionUnder({ sampled, isRemote: true }, '/[lang=lang]', kind);
				expect(decision).toBe(SamplingDecision.RECORD_AND_SAMPLED);
			});
		}
		for (const route of ['/healthz', '/readyz']) {
			it(`drops a ${kindName} root of ${route} even when the remote parent is sampled`, () => {
				const decision = decisionUnder({ sampled: true, isRemote: true }, route, kind);
				expect(decision).toBe(SamplingDecision.NOT_RECORD);
			});
		}
	}

	it('follows a local unsampled parent (children of a dropped probe stay dropped)', () => {
		const decision = decisionUnder(
			{ sampled: false, isRemote: false },
			'/[lang=lang]',
			SpanKind.INTERNAL
		);
		expect(decision).toBe(SamplingDecision.NOT_RECORD);
	});

	it('follows a local sampled parent', () => {
		const decision = decisionUnder(
			{ sampled: true, isRemote: false },
			'unknown',
			SpanKind.INTERNAL
		);
		expect(decision).toBe(SamplingDecision.RECORD_AND_SAMPLED);
	});
});
