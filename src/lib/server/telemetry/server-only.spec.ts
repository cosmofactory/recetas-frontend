import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { repoFile } from '../../../testutil/load-export';

// FE-2 / stack.md X6: no browser telemetry and no client-side SDK. The
// OpenTelemetry and Logfire packages may only be imported where Kit never
// bundles for the browser and where the telemetry code lives:
// src/lib/server/ and src/instrumentation.server.ts. Tests and test helpers
// are exempt (they never ship).

const TELEMETRY_IMPORT = /(?:from\s*|import\s*\(?\s*)['"](@opentelemetry|@pydantic)\//;
const SOURCE_FILE = /\.(?:ts|js|svelte)$/;
const TEST_FILE = /\.(?:spec|test|e2e)\.ts$/;
const ALLOWED = ['src/lib/server/', 'src/instrumentation.server.ts', 'src/testutil/'];

function sourceFiles(): string[] {
	const files = readdirSync(repoFile('src'), { recursive: true, encoding: 'utf8' });
	return files
		.map((file) => path.posix.join('src', file.split(path.sep).join('/')))
		.filter((file) => SOURCE_FILE.test(file) && !TEST_FILE.test(file))
		.filter((file) => !ALLOWED.some((prefix) => file.startsWith(prefix)));
}

describe('telemetry stays on the server', () => {
	it('the scan sees the app’s source files', () => {
		expect(sourceFiles()).toContain('src/hooks.server.ts');
	});

	it('no file outside src/lib/server/ and src/instrumentation.server.ts imports @opentelemetry/* or @pydantic/*', () => {
		const offenders = sourceFiles().filter((file) =>
			TELEMETRY_IMPORT.test(readFileSync(repoFile(file), 'utf8'))
		);
		expect(offenders).toEqual([]);
	});

	const samples = [
		"import { trace } from '@opentelemetry/api';",
		"import '@pydantic/logfire-node';",
		"const otel = await import('@opentelemetry/api');"
	];
	for (const sample of samples) {
		it(`the pattern catches ${sample}`, () => {
			expect(TELEMETRY_IMPORT.test(sample)).toBe(true);
		});
	}
});
