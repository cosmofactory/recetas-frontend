import { diag } from '@opentelemetry/api';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { captureLogLines } from '../../../testutil/log-capture';
import { loadExport } from '../../../testutil/load-export';
import { disableTracing } from '../../../testutil/otel';

// FE-2 observability: the OTel SDK reports its own trouble (a failed OTLP
// export, a rejected token) through `diag`. Once telemetry is enabled, those
// reports at WARN and above go through the structured logger, so they reach
// Docker's log as JSON lines; below WARN they are dropped. The Logfire token
// travels in the exporter's headers and must never be written to a log line.

type StartTelemetry = (env: Record<string, string | undefined>) => void;

const TOKEN = 'pylf_v1_eu_secret-write-token';
const ENABLED = {
	LOGFIRE_TOKEN: TOKEN,
	OTEL_EXPORTER_OTLP_ENDPOINT: 'https://logfire-eu.pydantic.dev',
	APP_ENV: 'demo'
};
const DIAG_LEVELS = ['WARN', 'ERROR'];

async function startEnabled() {
	const startTelemetry = await loadExport<StartTelemetry>(
		'src/lib/server/telemetry/setup.ts',
		'startTelemetry'
	);
	const out = captureLogLines();
	startTelemetry(ENABLED);
	const before = out.lines().length;
	return { out, newLines: () => out.lines().slice(before) };
}

describe('startTelemetry: OTel diagnostics', () => {
	beforeEach(disableTracing);
	afterEach(() => {
		diag.disable();
		disableTracing();
		vi.restoreAllMocks();
	});

	for (const method of ['warn', 'error'] as const) {
		it(`diag.${method} becomes one JSON log line at WARN or above`, async () => {
			const { newLines } = await startEnabled();
			diag[method]('OTLPExporterError: Service Unavailable');
			const lines = newLines();
			expect(lines).toHaveLength(1);
			expect(JSON.stringify(lines[0])).toContain('OTLPExporterError: Service Unavailable');
			expect(DIAG_LEVELS, `got level ${String(lines[0].level)}`).toContain(lines[0].level);
		});
	}

	for (const method of ['info', 'debug', 'verbose'] as const) {
		it(`diag.${method} writes nothing`, async () => {
			const { newLines } = await startEnabled();
			diag[method]('exporting 3 spans');
			expect(newLines()).toEqual([]);
		});
	}

	it('never writes the token, even when a diagnostic carries it', async () => {
		const { out } = await startEnabled();
		diag.error(`export failed with Authorization: ${TOKEN}`, {
			headers: { Authorization: TOKEN }
		});
		expect(out.raw()).toContain('export failed');
		expect(out.raw()).not.toContain(TOKEN);
	});
});
