// Lighthouse CI for the D-FE8-2 budgets (stack.md F4 "Performance
// budgets"): LCP and CLS on the home, Variations and Recipe pages of the
// production server with mock data. This config is the mobile run
// (Lighthouse's default Moto G Power emulation); `pnpm lhci:desktop` runs the
// same config with `--collect.settings.preset=desktop`. Results stay on
// disk (gitignored), never on a public server.
//
// An ES module (package.json "type": "module") that lhci require()s; Node
// 24 loads it synchronously, so the config is the named export `ci`, not a
// default export. Budget values live only in src/testutil/perf-budgets.ts
// (imported through Node's type stripping).
import {
	BUDGETED_PATHS,
	CLS_BUDGET,
	LCP_BUDGET_MS,
	LIGHTHOUSE_RUNS
} from './src/testutil/perf-budgets.ts';

// Not the E2E port (4173), so a running Playwright server (APP_ENV=demo)
// is never measured by mistake.
const PORT = 4174;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const LOCALE = 'en';

// The env playwright.config.ts gives `node build`, but prod: what users get.
const serverEnv = [
	`PORT=${PORT}`,
	'HOST=127.0.0.1',
	`PUBLIC_ORIGIN=${ORIGIN}`,
	'APP_ENV=prod',
	'DATA_SOURCE=mock'
].join(' ');

// Median of the runs, not lhci's default "optimistic" (best run).
const budget = (maxNumericValue) => ['error', { maxNumericValue, aggregationMethod: 'median' }];

export const ci = {
	collect: {
		startServerCommand: `env ${serverEnv} node build`,
		startServerReadyPattern: 'Listening on',
		url: BUDGETED_PATHS.map((path) => `${ORIGIN}/${LOCALE}${path}`),
		numberOfRuns: LIGHTHOUSE_RUNS,
		settings: { onlyCategories: ['performance'] }
	},
	assert: {
		assertions: {
			'largest-contentful-paint': budget(LCP_BUDGET_MS),
			'cumulative-layout-shift': budget(CLS_BUDGET)
		}
	},
	upload: { target: 'filesystem', outputDir: '.lighthouseci/mobile' }
};
