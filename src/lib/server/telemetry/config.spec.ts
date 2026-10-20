import { describe, expect, it } from 'vitest';
import { loadExport } from '../../../testutil/load-export';

// FE-2 observability (stack.md B7, BE-1): telemetry is off unless
// LOGFIRE_TOKEN is set. When it is, the OTLP/HTTP trace exporter posts to
// <OTEL_EXPORTER_OTLP_ENDPOINT>/v1/traces with `Authorization: <token>`, and
// the resource carries service.name, service.version and
// deployment.environment (APP_ENV, as on the Go side). Env names match BE-1.

type Env = Record<string, string | undefined>;
type TelemetryConfig =
	| { enabled: false }
	| {
			enabled: true;
			tracesUrl: string;
			headers: Record<string, string>;
			serviceName: string;
			serviceVersion: string;
			environment: 'local' | 'demo' | 'prod';
	  };
type ConfigFn = (env: Env) => TelemetryConfig;

const TOKEN = 'pylf_v1_eu_secret-write-token';
const ENDPOINT = 'https://logfire-eu.pydantic.dev';

const ENABLED: Env = {
	LOGFIRE_TOKEN: TOKEN,
	OTEL_EXPORTER_OTLP_ENDPOINT: ENDPOINT,
	APP_ENV: 'demo'
};

const load = () => loadExport<ConfigFn>('src/lib/server/telemetry/config.ts', 'telemetryConfig');

function thrown(fn: () => unknown): Error {
	try {
		fn();
	} catch (err) {
		return err as Error;
	}
	throw new Error('got a config, want an error');
}

describe('telemetryConfig: disabled', () => {
	const cases: { name: string; env: Env }[] = [
		{ name: 'LOGFIRE_TOKEN unset', env: {} },
		{ name: 'LOGFIRE_TOKEN empty', env: { LOGFIRE_TOKEN: '' } },
		{ name: 'LOGFIRE_TOKEN blank', env: { LOGFIRE_TOKEN: '  ' } },
		// Without a token nothing else is validated: local dev needs no setup.
		{
			name: 'no token, other telemetry variables invalid',
			env: { APP_ENV: 'staging', OTEL_EXPORTER_OTLP_ENDPOINT: 'not a url' }
		}
	];
	for (const { name, env } of cases) {
		it(`is { enabled: false } when ${name}`, async () => {
			const telemetryConfig = await load();
			expect(telemetryConfig(env)).toEqual({ enabled: false });
		});
	}
});

describe('telemetryConfig: enabled', () => {
	it('exports to the endpoint with the token as Authorization and the default service name', async () => {
		const telemetryConfig = await load();
		expect(telemetryConfig({ ...ENABLED, APP_VERSION: 'sha-1a2b3c4' })).toMatchObject({
			enabled: true,
			tracesUrl: `${ENDPOINT}/v1/traces`,
			headers: { Authorization: TOKEN },
			serviceName: 'recetas-frontend',
			serviceVersion: 'sha-1a2b3c4',
			environment: 'demo'
		});
	});

	const cases: { name: string; env: Env; want: Record<string, unknown> }[] = [
		{
			name: 'OTEL_SERVICE_NAME overrides the service name',
			env: { OTEL_SERVICE_NAME: 'recetas-frontend-canary' },
			want: { serviceName: 'recetas-frontend-canary' }
		},
		{
			name: 'a trailing slash on the endpoint is not doubled',
			env: { OTEL_EXPORTER_OTLP_ENDPOINT: `${ENDPOINT}/` },
			want: { tracesUrl: `${ENDPOINT}/v1/traces` }
		},
		{
			name: 'an endpoint with a path keeps it',
			env: { OTEL_EXPORTER_OTLP_ENDPOINT: 'https://otel.example.org/logfire' },
			want: { tracesUrl: 'https://otel.example.org/logfire/v1/traces' }
		},
		{
			// The Dockerfile bakes APP_VERSION; `pnpm dev` has none.
			name: 'serviceVersion defaults to "dev" without APP_VERSION',
			env: {},
			want: { serviceVersion: 'dev' }
		},
		...['local', 'demo', 'prod'].map((appEnv) => ({
			name: `APP_ENV=${appEnv} is the environment`,
			env: { APP_ENV: appEnv },
			want: { environment: appEnv }
		}))
	];
	for (const { name, env, want } of cases) {
		it(name, async () => {
			const telemetryConfig = await load();
			expect(telemetryConfig({ ...ENABLED, ...env })).toMatchObject({ enabled: true, ...want });
		});
	}
});

describe('telemetryConfig: invalid with a token', () => {
	const cases: { name: string; env: Env; names: string }[] = [
		{ name: 'APP_ENV unset', env: { APP_ENV: undefined }, names: 'APP_ENV' },
		{ name: 'APP_ENV unknown', env: { APP_ENV: 'staging' }, names: 'APP_ENV' },
		{
			name: 'endpoint unset',
			env: { OTEL_EXPORTER_OTLP_ENDPOINT: undefined },
			names: 'OTEL_EXPORTER_OTLP_ENDPOINT'
		},
		{
			name: 'endpoint not a URL',
			env: { OTEL_EXPORTER_OTLP_ENDPOINT: 'logfire-eu.pydantic.dev' },
			names: 'OTEL_EXPORTER_OTLP_ENDPOINT'
		},
		{
			// The token must never travel in clear text.
			name: 'endpoint over plain http',
			env: { OTEL_EXPORTER_OTLP_ENDPOINT: 'http://logfire-eu.pydantic.dev' },
			names: 'OTEL_EXPORTER_OTLP_ENDPOINT'
		}
	];
	for (const { name, env, names } of cases) {
		it(`throws an error naming ${names} when ${name}`, async () => {
			const telemetryConfig = await load();
			const err = thrown(() => telemetryConfig({ ...ENABLED, ...env }));
			expect(err.message).toContain(names);
		});

		it(`does not leak the token in the error when ${name}`, async () => {
			const telemetryConfig = await load();
			const err = thrown(() => telemetryConfig({ ...ENABLED, ...env }));
			expect(err.message).not.toContain(TOKEN);
		});
	}
});
