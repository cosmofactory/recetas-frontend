import { EXTERNAL_BASE_URL } from './e2e-target';

// The PUBLIC_ORIGIN the e2e server runs with (playwright.config.ts). Head
// tags must use it verbatim, whatever host the request came in on. Against a
// deployment (E2E_BASE_URL) that is its own origin: demo runs with
// PUBLIC_ORIGIN=https://demo.asadorov.es.
export const PUBLIC_ORIGIN = EXTERNAL_BASE_URL ?? 'http://127.0.0.1:4173';
