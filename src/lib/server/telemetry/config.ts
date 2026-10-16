// Server telemetry settings from the environment (stack.md B7; names as in
// BE-1). No LOGFIRE_TOKEN means telemetry is off and nothing else is read, so
// local dev needs no setup. With a token every other setting must be valid;
// error messages name the variable but never echo the token.

export const appEnvs = ['local', 'demo', 'prod'] as const;
export type AppEnv = (typeof appEnvs)[number];

export type TelemetryConfig =
	| { enabled: false }
	| {
			enabled: true;
			tracesUrl: string;
			headers: Record<string, string>;
			serviceName: string;
			serviceVersion: string;
			environment: AppEnv;
	  };

type Env = Record<string, string | undefined>;

const DEFAULT_SERVICE_NAME = 'recetas-frontend';
// `pnpm dev` has no APP_VERSION; the Dockerfile bakes the image tag in.
const DEFAULT_SERVICE_VERSION = 'dev';
const TRACES_PATH = '/v1/traces';

export function telemetryConfig(env: Env): TelemetryConfig {
	const token = env.LOGFIRE_TOKEN?.trim();
	if (!token) return { enabled: false };
	return {
		enabled: true,
		tracesUrl: parseTracesUrl(env.OTEL_EXPORTER_OTLP_ENDPOINT),
		headers: { Authorization: token },
		serviceName: env.OTEL_SERVICE_NAME || DEFAULT_SERVICE_NAME,
		serviceVersion: env.APP_VERSION || DEFAULT_SERVICE_VERSION,
		environment: parseAppEnv(env.APP_ENV)
	};
}

function parseAppEnv(value: string | undefined): AppEnv {
	if ((appEnvs as readonly (string | undefined)[]).includes(value)) return value as AppEnv;
	throw new Error(`APP_ENV must be one of ${appEnvs.join(', ')}, got ${JSON.stringify(value)}`);
}

// The token travels in a header, so the endpoint must be https.
// "https://logfire-eu.pydantic.dev/" -> "https://logfire-eu.pydantic.dev/v1/traces".
function parseTracesUrl(endpoint: string | undefined): string {
	const url = endpoint ? URL.parse(endpoint) : null;
	if (url?.protocol !== 'https:') {
		throw new Error(
			`OTEL_EXPORTER_OTLP_ENDPOINT must be an https URL when LOGFIRE_TOKEN is set, got ${JSON.stringify(endpoint)}`
		);
	}
	return `${url.href.replace(/\/$/, '')}${TRACES_PATH}`;
}
