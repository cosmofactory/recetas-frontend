// pnpm api:sync: copies the backend's OpenAPI spec into src/lib/api/,
// regenerates schema.d.ts, and copies the backend's design content bundle for
// the mock data source (D-FE2-1). Sources are API_SPEC_URL and API_BUNDLE_URL
// (file paths or http(s) URLs), by default the sibling backend checkout.
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
	generateTypes,
	readSource,
	VENDORED_BUNDLE,
	VENDORED_SPEC,
	VENDORED_TYPES
} from './api-spec.ts';

const BACKEND = path.resolve(import.meta.dirname, '../../recetas-backend');
const DEFAULT_SPEC = path.join(BACKEND, 'api/openapi.yaml');
const DEFAULT_BUNDLE = path.join(BACKEND, 'testdata/content.design.json');

async function main(): Promise<number> {
	const specSource = process.env.API_SPEC_URL || DEFAULT_SPEC;
	const bundleSource = process.env.API_BUNDLE_URL || DEFAULT_BUNDLE;
	const spec = await readSource(specSource);
	await writeFile(VENDORED_SPEC, spec);
	await writeFile(VENDORED_TYPES, await generateTypes(spec));
	await writeFile(VENDORED_BUNDLE, await readSource(bundleSource));
	console.log(`api:sync: ${specSource} -> ${VENDORED_SPEC} and ${VENDORED_TYPES}`);
	console.log(`api:sync: ${bundleSource} -> ${VENDORED_BUNDLE}`);
	return 0;
}

if (import.meta.main) {
	process.exitCode = await main();
}
