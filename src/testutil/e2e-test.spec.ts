import { globSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// FE-8 acceptance: "no CSP violations across the e2e suite". The guard lives
// in the `page` fixture of testutil/e2e-test.ts, so it only covers specs that
// import `test` from there; a spec importing @playwright/test directly would
// silently skip it.

const E2E_SPECS = 'src/**/*.e2e.ts';

describe('E2E specs use the CSP-guarded test', () => {
	const files = globSync(E2E_SPECS);

	it('finds the E2E specs', () => {
		expect(files.length, `got no files for ${E2E_SPECS}`).toBeGreaterThan(0);
	});

	it('no spec imports from @playwright/test directly', () => {
		const direct = files.filter((file) =>
			/from '@playwright\/test'/.test(readFileSync(file, 'utf8'))
		);
		expect(direct, 'want them to import from testutil/e2e-test').toEqual([]);
	});
});
