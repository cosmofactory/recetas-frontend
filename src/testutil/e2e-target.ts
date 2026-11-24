import { test } from '@playwright/test';

// Where the E2E suite runs (FE-8 PR 5b). By default playwright.config.ts
// builds and starts `node build` on 127.0.0.1:4173 (DATA_SOURCE=mock,
// APP_ENV=demo). With E2E_BASE_URL set (e.g. https://demo.asadorov.es, the
// nightly run) it targets that deployment instead and starts nothing.

const TRAILING_SLASHES = /\/+$/;

function externalBaseUrl(): string | undefined {
	const raw = process.env.E2E_BASE_URL?.trim();
	return raw ? raw.replace(TRAILING_SLASHES, '') : undefined;
}

// The deployment under test, without a trailing slash; undefined for the
// local server.
export const EXTERNAL_BASE_URL = externalBaseUrl();

// Skips the current test, or every test of the describe it's called in,
// when the suite targets an external deployment: for checks that need the
// local server's environment (startAppServer, the mock build's APP_ENV, no
// proxy in front, a production build to measure).
export function skipAgainstDeployment(why: string) {
	test.skip(EXTERNAL_BASE_URL !== undefined, `needs the local E2E server: ${why}`);
}

// Tags a test (or a describe) whose assertions read the mock bundle's
// content (src/lib/server/mock/content.bundle.json: its dishes, counts,
// names, Spanish variations). A deployment serves its own content bundle,
// so playwright.config.ts leaves these out (grepInvert) when E2E_BASE_URL is
// set; on the local mock run, the PR gate, they run as before.
export const MOCK_DATA_TAG = '@mock-data';

// True on the local run, which serves the mock bundle (DATA_SOURCE=mock).
export const ON_MOCK_DATA = EXTERNAL_BASE_URL === undefined;
