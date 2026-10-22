import { dev, building } from '$app/env';
import { defineEnvVars } from '@sveltejs/kit/env';
import { DEFAULT_APP_ENV, parseAppEnv } from '#lib/server/app-env.ts';
import { selectSource } from '#lib/server/data-source.ts';
import { telemetryConfig } from '#lib/server/telemetry/config.ts';
import { parseMediaBaseUrl } from '#lib/media.ts';

const DEV_ORIGIN = 'http://localhost:5173';
// Where `make -C ../recetas-backend docker-up` serves the API.
const DEV_BACKEND_URL = 'http://localhost:8080';

// "https://demo.asadorov.es" -> itself; a path, query or other scheme is a
// configuration error.
function parseOrigin(name: string, value: string): string {
	const url = URL.parse(value);
	if (!url || !/^https?:$/.test(url.protocol) || url.origin !== value.replace(/\/$/, '')) {
		throw new Error(`${name} must be a bare http(s) origin, got ${JSON.stringify(value)}`);
	}
	return url.origin;
}

// The API is only needed when the catalog comes from it. A schema can't see
// another variable's parsed value, so this reads the raw DATA_SOURCE.
function backendRequired(): boolean {
	return !building && selectSource(process.env) === 'api';
}

// Telemetry is configured by src/instrumentation.server.ts, which runs before
// the app and reads process.env through telemetryConfig. The variables are
// declared here for documentation, and LOGFIRE_TOKEN's schema runs the same
// validation (not at build time, which has no runtime secrets); it returns
// undefined so the token never reaches $app/env.
function validateTelemetry(token: string | undefined): undefined {
	if (!building) telemetryConfig({ ...process.env, LOGFIRE_TOKEN: token });
	return undefined;
}

// Read by telemetryConfig; validated there, together with LOGFIRE_TOKEN.
const optional = (value: string | undefined) => value;

export const variables = defineEnvVars({
	PUBLIC_ORIGIN: {
		description:
			'The public origin of the site, e.g. https://demo.asadorov.es. Canonical and hreflang URLs are built from it, never from the request Host header. Required outside `vite dev`.',
		schema: (value) => {
			if (value) return parseOrigin('PUBLIC_ORIGIN', value);
			if (dev || building) return DEV_ORIGIN;
			throw new Error('PUBLIC_ORIGIN is not set (e.g. PUBLIC_ORIGIN=https://demo.asadorov.es)');
		}
	},
	DATA_SOURCE: {
		description:
			'Where the catalog comes from: `api` (default, the Go API at BACKEND_API_BASE_URL) or `mock` (the vendored content bundle; local dev and tests only).',
		schema: (value) => selectSource({ DATA_SOURCE: value })
	},
	BACKEND_API_BASE_URL: {
		description:
			'Internal origin of the Go API, e.g. http://backend:8080 (stack.md X4); never exposed to the browser. Required when DATA_SOURCE=api, outside `vite dev`.',
		schema: (value) => {
			if (value) return parseOrigin('BACKEND_API_BASE_URL', value);
			if (!backendRequired()) return undefined;
			if (dev) return DEV_BACKEND_URL;
			throw new Error(
				'BACKEND_API_BASE_URL is not set (e.g. BACKEND_API_BASE_URL=http://backend:8080)'
			);
		}
	},
	MEDIA_BASE_URL: {
		public: true,
		description:
			'CloudFront base URL that photo URLs are built against (stack.md X3, INF-4): https, optionally with a path, e.g. https://d1abc.cloudfront.net/media. Unset means every photo renders as the striped placeholder.',
		schema: parseMediaBaseUrl
	},
	LOGFIRE_TOKEN: {
		description:
			'Logfire write token (INF-3). Unset: server telemetry is off and nothing else below is read. Set: traces go to OTEL_EXPORTER_OTLP_ENDPOINT with `Authorization: <token>`. Read only by src/instrumentation.server.ts, never exposed through $app/env.',
		schema: validateTelemetry
	},
	OTEL_EXPORTER_OTLP_ENDPOINT: {
		description:
			'Logfire regional OTLP base URL (https), e.g. https://logfire-eu.pydantic.dev; traces go to <endpoint>/v1/traces. Required when LOGFIRE_TOKEN is set.',
		schema: optional
	},
	OTEL_SERVICE_NAME: {
		description: 'The service.name resource attribute; default `recetas-frontend`.',
		schema: optional
	},
	APP_ENV: {
		description:
			'`local`, `demo` or `prod`. Only `prod` is indexable: anything else answers robots.txt `Disallow: /` and sends `X-Robots-Tag: noindex`. Also the deployment.environment.name telemetry attribute. Required outside `vite dev`.',
		schema: (value) => {
			if (!value && (dev || building)) return DEFAULT_APP_ENV;
			return parseAppEnv(value);
		}
	},
	APP_VERSION: {
		description:
			'The service.version resource attribute; the Dockerfile bakes in the image tag (default `dev`).',
		schema: optional
	}
});
