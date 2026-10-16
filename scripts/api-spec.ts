// The vendored backend contract (D-FE2-1, stack.md F8): src/lib/api/openapi.yaml
// is a byte-identical copy of recetas-backend/api/openapi.yaml, and
// src/lib/api/schema.d.ts is generated from it by openapi-typescript. The mock
// data source's bundle, src/lib/server/mock/content.bundle.json, is likewise a
// copy of recetas-backend/testdata/content.design.json.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import openapiTS, { astToString, COMMENT_HEADER } from 'openapi-typescript';

const repoRoot = path.resolve(import.meta.dirname, '..');

export const VENDORED_SPEC = path.join(repoRoot, 'src/lib/api/openapi.yaml');
export const VENDORED_TYPES = path.join(repoRoot, 'src/lib/api/schema.d.ts');
export const VENDORED_BUNDLE = path.join(repoRoot, 'src/lib/server/mock/content.bundle.json');

const FETCH_TIMEOUT_MS = 30_000;

export function isHttpUrl(source: string): boolean {
	return /^https?:\/\//.test(source);
}

async function fetchText(url: string): Promise<string> {
	const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
	if (!response.ok) throw new Error(`GET ${url}: ${response.status}`);
	return response.text();
}

// A file path or an http(s) URL; a failed download is retried once.
export async function readSource(source: string): Promise<string> {
	if (!isHttpUrl(source)) return readFile(source, 'utf8');
	try {
		return await fetchText(source);
	} catch (err) {
		console.warn(`GET ${source} failed (${String(err)}), retrying once`);
		return fetchText(source);
	}
}

// The same output as the openapi-typescript CLI with default options.
export async function generateTypes(spec: string): Promise<string> {
	return `${COMMENT_HEADER}${astToString(await openapiTS(spec, { silent: true }))}`;
}

export type DriftInput = {
	vendoredSpec: string;
	upstreamSpec: string;
	vendoredTypes: string;
	generatedTypes: string;
	vendoredBundle: string;
	upstreamBundle: string;
};

// What is out of date; empty when the vendored copies and the types are current.
export function findDrift(input: DriftInput): string[] {
	const problems: string[] = [];
	if (input.vendoredSpec !== input.upstreamSpec) {
		problems.push('src/lib/api/openapi.yaml differs from the backend spec; run `pnpm api:sync`');
	}
	if (input.vendoredTypes !== input.generatedTypes) {
		problems.push(
			'src/lib/api/schema.d.ts is not generated from openapi.yaml; run `pnpm api:sync`'
		);
	}
	if (input.vendoredBundle !== input.upstreamBundle) {
		problems.push(
			'src/lib/server/mock/content.bundle.json differs from the backend testdata/content.design.json; run `pnpm api:sync`'
		);
	}
	return problems;
}
