// The deployment environment (APP_ENV), the same enum as the Go API's. It
// names the telemetry environment and decides whether search engines may
// index the site (FE-8): only prod is indexable, so local behaves like demo.

export const appEnvs = ['local', 'demo', 'prod'] as const;
export type AppEnv = (typeof appEnvs)[number];

// `vite dev` and the build have no runtime environment.
export const DEFAULT_APP_ENV: AppEnv = 'local';
const INDEXABLE_APP_ENV: AppEnv = 'prod';

export function parseAppEnv(value: string | undefined): AppEnv {
	if ((appEnvs as readonly (string | undefined)[]).includes(value)) return value as AppEnv;
	throw new Error(`APP_ENV must be one of ${appEnvs.join(', ')}, got ${JSON.stringify(value)}`);
}

export const isIndexable = (appEnv: AppEnv): boolean => appEnv === INDEXABLE_APP_ENV;
