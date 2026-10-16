import { startTelemetry } from '#lib/server/telemetry/setup.ts';

// Loaded by adapter-node before any application code, so the tracer provider
// is in place before Kit records its first span (stack.md B7).
startTelemetry(process.env);
