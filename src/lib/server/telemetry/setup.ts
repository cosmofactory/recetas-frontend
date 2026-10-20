import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { defaultResource, resourceFromAttributes } from '@opentelemetry/resources';
import { BatchSpanProcessor, NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import {
	ATTR_DEPLOYMENT_ENVIRONMENT_NAME,
	ATTR_SERVICE_NAME,
	ATTR_SERVICE_VERSION
} from '@opentelemetry/semantic-conventions';
import { log } from '../log.ts';
import { telemetryConfig, type TelemetryConfig } from './config.ts';
import { startDiagLogging } from './diag-logger.ts';
import { probeSkippingSampler } from './probe-sampler.ts';

// Server-side tracing to Logfire over OTLP/HTTP (stack.md B7). Kit's
// `tracing.server` creates the request, handle and load spans; this registers
// the provider they go to, with the AsyncLocalStorage context manager and the
// W3C propagator. Spans are batched, so a slow or unreachable endpoint never
// adds request latency. Without LOGFIRE_TOKEN nothing is registered and every
// span is a no-op.

type EnabledConfig = Extract<TelemetryConfig, { enabled: true }>;

// Within Docker's 10s stop grace period, after the last request has ended.
const EXPORT_TIMEOUT_MS = 5_000;
// adapter-node emits this once its HTTP server has closed (graceful shutdown).
const SHUTDOWN_EVENT = 'sveltekit:shutdown';

export function startTelemetry(env: Record<string, string | undefined>): void {
	const config = telemetryConfig(env);
	if (!config.enabled) {
		log.info('telemetry disabled');
		return;
	}
	startDiagLogging(config.headers.Authorization);
	const provider = createProvider(config);
	provider.register();
	process.once(SHUTDOWN_EVENT, () => flushOnShutdown(provider));
	log.info('telemetry enabled', {
		service: config.serviceName,
		version: config.serviceVersion,
		environment: config.environment,
		traces_url: config.tracesUrl
	});
}

function createProvider(config: EnabledConfig): NodeTracerProvider {
	const exporter = new OTLPTraceExporter({
		url: config.tracesUrl,
		headers: config.headers,
		timeoutMillis: EXPORT_TIMEOUT_MS
	});
	return new NodeTracerProvider({
		resource: defaultResource().merge(
			resourceFromAttributes({
				[ATTR_SERVICE_NAME]: config.serviceName,
				[ATTR_SERVICE_VERSION]: config.serviceVersion,
				[ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: config.environment
			})
		),
		sampler: probeSkippingSampler(),
		spanProcessors: [new BatchSpanProcessor(exporter)]
	});
}

async function flushOnShutdown(provider: NodeTracerProvider): Promise<void> {
	try {
		await provider.shutdown();
	} catch (err) {
		log.error('telemetry flush failed', { err });
	}
}
