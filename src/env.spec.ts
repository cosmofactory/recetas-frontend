import { describe, expect, it, vi } from 'vitest';
import { loadExport } from './testutil/load-export';

// FE-2 media: MEDIA_BASE_URL is the CloudFront base (INF-4) that photo URLs
// are built against. Kit 3 exposes it to the browser through
// `$app/env/public` when declared with `public: true` (no PUBLIC_ prefix is
// needed). It is optional until INF-4 exists: unset means every photo renders
// as the striped placeholder, in dev, build and at runtime alike.

vi.mock('$app/env', () => ({ dev: false, building: false }));

type Validation = { value?: unknown; issues?: readonly { message: string }[] };
type EnvEntry = {
	public?: boolean;
	schema: { '~standard': { validate: (value: unknown) => Validation | Promise<Validation> } };
};

async function mediaBaseUrl(): Promise<EnvEntry> {
	const variables = await loadExport<Record<string, EnvEntry>>('src/env.ts', 'variables');
	const entry = variables.MEDIA_BASE_URL;
	expect(entry, 'src/env.ts must declare MEDIA_BASE_URL').toBeDefined();
	return entry;
}

async function validate(value: string | undefined): Promise<Validation> {
	return (await mediaBaseUrl()).schema['~standard'].validate(value);
}

describe('MEDIA_BASE_URL', () => {
	it('is public, so the browser can build image URLs', async () => {
		const entry = await mediaBaseUrl();
		expect(entry.public, `got public=${entry.public}, want true`).toBe(true);
	});

	it('is optional outside dev and build: unset is accepted as undefined', async () => {
		const got = await validate(undefined);
		expect(got.issues, `got issues ${JSON.stringify(got.issues)}, want none`).toBeUndefined();
		expect(got.value).toBeUndefined();
	});

	it('normalises a trailing slash away', async () => {
		const got = await validate('https://d1abc.cloudfront.net/media/');
		expect(got.value).toBe('https://d1abc.cloudfront.net/media');
	});

	it('rejects a non-https value as a configuration error', async () => {
		const got = await validate('http://media.asadorov.es');
		expect(got.issues?.length, 'got no issues, want a validation issue').toBeGreaterThan(0);
	});
});

// FE-8 PR 1 (stage FE-8 -> Env vars): APP_ENV decides whether the site may be
// indexed (`prod`) or not (demo: robots `Disallow: /` + `X-Robots-Tag:
// noindex`). It is required outside `vite dev` and the build, like
// PUBLIC_ORIGIN, so a deployment can't silently fall back to either mode. The
// values are the one enum the Go API and telemetry already use
// (`local|demo|prod`, appEnvs in #lib/server/app-env.ts), so
// APP_ENV=local with a LOGFIRE_TOKEN keeps working.

async function appEnv(value: string | undefined): Promise<Validation> {
	const variables = await loadExport<Record<string, EnvEntry>>('src/env.ts', 'variables');
	const entry = variables.APP_ENV;
	expect(entry, 'src/env.ts must declare APP_ENV').toBeDefined();
	return entry.schema['~standard'].validate(value);
}

describe('APP_ENV', () => {
	for (const value of ['local', 'demo', 'prod']) {
		it(`accepts ${value}`, async () => {
			const got = await appEnv(value);
			expect(got.issues, `got issues ${JSON.stringify(got.issues)}, want none`).toBeUndefined();
			expect(got.value, `got ${JSON.stringify(got.value)}, want ${value}`).toBe(value);
		});
	}

	const invalid: { name: string; value: string | undefined }[] = [
		{ name: 'unset (it is required at runtime)', value: undefined },
		{ name: 'empty', value: '' },
		{ name: 'an unknown environment', value: 'staging' },
		{ name: 'a differently cased value', value: 'PROD' }
	];
	for (const { name, value } of invalid) {
		it(`rejects ${name}`, async () => {
			const got = await appEnv(value);
			expect(
				(got.issues ?? []).length,
				`got value ${JSON.stringify(got.value)}, want an issue`
			).toBeGreaterThan(0);
			expect(JSON.stringify(got.issues), 'want the issue to name APP_ENV').toContain('APP_ENV');
		});
	}
});
