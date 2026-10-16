// pnpm api:check (CI): fails when the vendored OpenAPI spec or mock bundle
// differs from the backend's main, or schema.d.ts is not generated from the
// spec (D-FE2-1). API_SPEC_URL and API_BUNDLE_URL override the upstreams
// (file paths or URLs).
import { readFile } from 'node:fs/promises';
import {
	findDrift,
	generateTypes,
	readSource,
	VENDORED_BUNDLE,
	VENDORED_SPEC,
	VENDORED_TYPES
} from './api-spec.ts';

const BACKEND_MAIN = 'https://raw.githubusercontent.com/cosmofactory/recetas-backend/main';

async function main(): Promise<number> {
	const specSource = process.env.API_SPEC_URL || `${BACKEND_MAIN}/api/openapi.yaml`;
	const bundleSource = process.env.API_BUNDLE_URL || `${BACKEND_MAIN}/testdata/content.design.json`;
	const vendoredSpec = await readFile(VENDORED_SPEC, 'utf8');
	const problems = findDrift({
		vendoredSpec,
		upstreamSpec: await readSource(specSource),
		vendoredTypes: await readFile(VENDORED_TYPES, 'utf8'),
		generatedTypes: await generateTypes(vendoredSpec),
		vendoredBundle: await readFile(VENDORED_BUNDLE, 'utf8'),
		upstreamBundle: await readSource(bundleSource)
	});
	if (problems.length === 0) {
		console.log(`api:check ok: the vendored copies match ${specSource} and ${bundleSource}`);
		return 0;
	}
	for (const problem of problems) console.error(`api:check: ${problem}`);
	return 1;
}

if (import.meta.main) {
	process.exitCode = await main();
}
