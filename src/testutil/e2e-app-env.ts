import { EXTERNAL_BASE_URL } from './e2e-target';

// The APP_ENV the e2e server runs with (playwright.config.ts). `demo`, as
// on demo.asadorov.es: robots disallows everything and every response
// carries X-Robots-Tag: noindex (FE-8). The prod mode is covered by the unit
// specs (robots.txt/server.spec.ts, hooks.server.robots.spec.ts).
export const APP_ENV = 'demo';

// The APP_ENV of the server under test. Locally that is APP_ENV above.
// Against a deployment (E2E_BASE_URL) it is assumed to be demo, the nightly
// target, unless E2E_APP_ENV=prod says it's the indexable production site.
export type TargetAppEnv = 'demo' | 'prod';

function targetAppEnv(): TargetAppEnv {
	if (!EXTERNAL_BASE_URL) return APP_ENV;
	return process.env.E2E_APP_ENV === 'prod' ? 'prod' : 'demo';
}

export const TARGET_APP_ENV = targetAppEnv();
