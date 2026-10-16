import { context, propagation, trace, type SpanContext } from '@opentelemetry/api';
import {
	InMemorySpanExporter,
	NodeTracerProvider,
	SimpleSpanProcessor,
	type ReadableSpan
} from '@opentelemetry/sdk-trace-node';

// An in-process OpenTelemetry setup for FE-2 observability tests: a global
// tracer provider with the AsyncLocalStorage context manager and the W3C
// propagator (what instrumentation.server.ts registers in production), whose
// finished spans land in memory instead of going to Logfire.

const TEST_TRACER = 'recetas-frontend-test';

export type TestTracing = {
	finishedSpans: () => ReadableSpan[];
	shutdown: () => Promise<void>;
};

export function startTestTracing(): TestTracing {
	const exporter = new InMemorySpanExporter();
	const provider = new NodeTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] });
	provider.register();
	return {
		finishedSpans: () => exporter.getFinishedSpans(),
		shutdown: async () => {
			await provider.shutdown();
			disableTracing();
		}
	};
}

// Telemetry disabled: no provider, context manager or propagator registered.
export function disableTracing(): void {
	trace.disable();
	context.disable();
	propagation.disable();
}

// Runs `fn` inside an active (test) span and returns that span's context.
export async function inActiveSpan<T>(
	fn: () => Promise<T>
): Promise<{ parent: SpanContext; result: T }> {
	return trace.getTracer(TEST_TRACER).startActiveSpan('test parent', async (span) => {
		try {
			return { parent: span.spanContext(), result: await fn() };
		} finally {
			span.end();
		}
	});
}

export async function settled(p: Promise<unknown>): Promise<void> {
	await p.catch(() => undefined);
}
