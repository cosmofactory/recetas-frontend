import { describe, expect, it } from 'vitest';
import { loadExport } from '../../testutil/load-export';

// FE-2: DATA_SOURCE picks the catalog source. `api` is the default; `mock`
// serves the vendored bundle (local dev and tests only); anything else is a
// configuration error, never a silent fallback.

type DataSourceKind = 'api' | 'mock';
type SelectSource = (env: { DATA_SOURCE?: string }) => DataSourceKind;

const load = () => loadExport<SelectSource>('src/lib/server/data-source.ts', 'selectSource');

describe('selectSource', () => {
	const valid: { env: { DATA_SOURCE?: string }; want: DataSourceKind }[] = [
		{ env: {}, want: 'api' },
		{ env: { DATA_SOURCE: '' }, want: 'api' },
		{ env: { DATA_SOURCE: 'api' }, want: 'api' },
		{ env: { DATA_SOURCE: 'mock' }, want: 'mock' }
	];
	for (const { env, want } of valid) {
		it(`picks ${want} for DATA_SOURCE=${JSON.stringify(env.DATA_SOURCE)}`, async () => {
			const got = (await load())(env);
			expect(got, `got ${got}, want ${want}`).toBe(want);
		});
	}

	for (const value of ['postgres', 'Mock', 'mock ', 'true']) {
		it(`rejects DATA_SOURCE=${JSON.stringify(value)} with a clear config error`, async () => {
			const selectSource = await load();
			expect(() => selectSource({ DATA_SOURCE: value })).toThrow(/DATA_SOURCE/);
			expect(() => selectSource({ DATA_SOURCE: value })).toThrow(JSON.stringify(value));
		});
	}
});
