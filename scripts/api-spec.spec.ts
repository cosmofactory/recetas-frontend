import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { findDrift, generateTypes, isHttpUrl, VENDORED_SPEC, VENDORED_TYPES } from './api-spec.ts';

// D-FE2-1: the vendored spec must match the backend's, schema.d.ts must be
// what openapi-typescript generates from it, and the mock bundle must match
// the backend's testdata/content.design.json (FE-2 mock data source).

const current = {
	vendoredSpec: 'a',
	upstreamSpec: 'a',
	vendoredTypes: 't',
	generatedTypes: 't',
	vendoredBundle: '{"schemaVersion":1}',
	upstreamBundle: '{"schemaVersion":1}'
};

describe('findDrift', () => {
	it('reports nothing when the spec and the types are current', () => {
		expect(findDrift(current)).toEqual([]);
	});

	it('reports a spec that differs from upstream', () => {
		const got = findDrift({ ...current, upstreamSpec: 'b' });
		expect(got).toHaveLength(1);
		expect(got[0]).toMatch(/openapi\.yaml.*pnpm api:sync/);
	});

	it('reports stale generated types', () => {
		const got = findDrift({ ...current, generatedTypes: 'u' });
		expect(got).toHaveLength(1);
		expect(got[0]).toMatch(/schema\.d\.ts.*pnpm api:sync/);
	});

	it('reports a mock bundle that differs from the backend content.design.json', () => {
		const got = findDrift({ ...current, upstreamBundle: '{"schemaVersion":2}' });
		expect(got, `got ${JSON.stringify(got)}, want one bundle problem`).toHaveLength(1);
		expect(got[0]).toMatch(/content\.bundle\.json.*pnpm api:sync/);
	});

	it('compares the bundle byte for byte (formatting counts)', () => {
		const got = findDrift({ ...current, upstreamBundle: '{ "schemaVersion": 1 }' });
		expect(got).toHaveLength(1);
	});

	it('reports the spec and the types at once', () => {
		expect(findDrift({ ...current, upstreamSpec: 'b', generatedTypes: 'u' })).toHaveLength(2);
	});

	it('reports all three at once', () => {
		const all = { ...current, upstreamSpec: 'b', generatedTypes: 'u', upstreamBundle: '[]' };
		expect(findDrift(all)).toHaveLength(3);
	});
});

describe('isHttpUrl', () => {
	const cases: [string, boolean][] = [
		['https://raw.githubusercontent.com/x/y/main/api/openapi.yaml', true],
		['http://localhost:8080/openapi.yaml', true],
		['../recetas-backend/api/openapi.yaml', false],
		['/abs/openapi.yaml', false]
	];
	for (const [source, want] of cases) {
		it(`${source} -> ${want}`, () => expect(isHttpUrl(source)).toBe(want));
	}
});

describe('generateTypes', () => {
	it('reproduces the committed schema.d.ts from the committed spec', async () => {
		const got = await generateTypes(readFileSync(VENDORED_SPEC, 'utf8'));
		expect(got === readFileSync(VENDORED_TYPES, 'utf8'), 'schema.d.ts is stale').toBe(true);
	});
});
