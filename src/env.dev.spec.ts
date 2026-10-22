import { describe, expect, it, vi } from 'vitest';
import { loadExport } from './testutil/load-export';

// FE-8 PR 1: under `vite dev` (and while building, which has no runtime env)
// APP_ENV may be unset. The default is `local`, which is not indexable: only
// an explicit APP_ENV=prod lets crawlers in, so a forgotten variable can
// never expose a non-production site to search engines.

const mode = vi.hoisted(() => ({ dev: true, building: false }));
vi.mock('$app/env', () => mode);

type Validation = { value?: unknown; issues?: readonly { message: string }[] };
type EnvEntry = {
	schema: { '~standard': { validate: (value: unknown) => Validation | Promise<Validation> } };
};

async function validateUnset(): Promise<Validation> {
	vi.resetModules();
	const variables = await loadExport<Record<string, EnvEntry>>('src/env.ts', 'variables');
	expect(variables.APP_ENV, 'src/env.ts must declare APP_ENV').toBeDefined();
	return variables.APP_ENV.schema['~standard'].validate(undefined);
}

describe('APP_ENV default', () => {
	const cases = [
		{ name: 'under vite dev', dev: true, building: false },
		{ name: 'while building', dev: false, building: true }
	];
	for (const tc of cases) {
		it(`is "local" when unset ${tc.name}`, async () => {
			Object.assign(mode, { dev: tc.dev, building: tc.building });
			const got = await validateUnset();
			expect(got.issues, `got issues ${JSON.stringify(got.issues)}, want none`).toBeUndefined();
			expect(got.value, `got ${JSON.stringify(got.value)}, want "local"`).toBe('local');
		});
	}
});
