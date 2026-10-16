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
